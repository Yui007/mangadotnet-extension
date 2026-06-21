import { detectMangaDotNetPage } from '../core/url-detection';
import { DownloadQueue } from '../downloads/queue';
import { DownloadStatus, type DownloadJob, type DownloadProgress } from '../downloads/types';
import { buildZipArchive } from '../downloads/exporters/zip';
import { buildCbzArchive } from '../downloads/exporters/cbz';
import { buildImagesExport } from '../downloads/exporters/images';
import { buildPdfArchive } from '../downloads/exporters/pdf';
import { loadSettings, type ExportFormat } from '../storage/settings';

const queue = new DownloadQueue();
let activeWorkers = 0;

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const promises: Promise<void>[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      const item = items[currentIndex];
      results[currentIndex] = await fn(item);
    }
  }

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    promises.push(worker());
  }

  await Promise.all(promises);
  return results;
}

// --- Keep-alive: prevent MV3 service worker from going idle ---
const KEEP_ALIVE_ALARM = 'mdnet-keepalive';
const KEEP_ALIVE_INTERVAL_MS = 20000; // 20s (MV3 kills after ~30s)

async function ensureKeepAlive(): Promise<void> {
  const existing = await chrome.alarms.get(KEEP_ALIVE_ALARM);
  if (!existing) {
    chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.33 }); // ~20s
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // No-op: just keeping the worker alive
  }
});

// Start keep-alive immediately and re-register on startup
ensureKeepAlive();
chrome.runtime.onStartup.addListener(() => ensureKeepAlive());

function broadcastProgress(progress: DownloadProgress) {
  chrome.runtime.sendMessage({ type: 'download-progress', progress }).catch(() => {});
}

function broadcastComplete(jobId: string) {
  chrome.runtime.sendMessage({ type: 'download-complete', jobId }).catch(() => {});
}

async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    return true;
  } catch {
    return false;
  }
}

async function relayToContentScript(tabId: number, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function processJob(job: DownloadJob, tabId: number): Promise<void> {
  queue.updateStatus(job.jobId, DownloadStatus.DOWNLOADING);
  let chaptersCompleted = 0;
  let chaptersFailed = 0;
  let pagesDownloaded = 0;

  const settings = await loadSettings();
  const maxChapters = settings.download.maxConcurrentChapters ?? 4;
  const maxImages = settings.download.maxConcurrentImages ?? 8;
  const maxRetries = settings.download.maxRetries ?? 3;
  const retryDelay = settings.download.retryDelay ?? 2;

  // Get image URLs for all chapters from content script
  const chapterImageMap: Record<number, { url: string; filename: string }[]> = {};
  let totalPages = 0;

  await runWithConcurrency(job.chapterIds, maxChapters, async (chapterId) => {
    if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;

    broadcastProgress({
      jobId: job.jobId,
      status: DownloadStatus.PREPARING,
      chaptersCompleted,
      chaptersFailed,
      totalChapters: job.chapterIds.length,
      pagesDownloaded,
      currentPage: `Fetching chapter ${chapterId} metadata...`,
      percent: 0
    });

    let attempt = 0;
    while (attempt <= maxRetries) {
      if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;
      try {
        const response = await relayToContentScript(tabId, { type: 'fetch-images', chapterId });
        const images = (response as { ok: boolean; images: { url: string; filename: string }[] })?.images || [];
        chapterImageMap[chapterId] = images;
        totalPages += images.length;
        chaptersCompleted += 1;
        break;
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) {
          chaptersFailed += 1;
          const msg = error instanceof Error ? error.message : String(error);
          job.errors.push(`Chapter ${chapterId}: ${msg}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
        }
      }
    }
  });

  if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;

  interface ImageDownloadTask {
    chapterId: number;
    url: string;
    filename: string;
  }

  const downloadTasks: ImageDownloadTask[] = [];
  for (const chapterId of job.chapterIds) {
    const images = chapterImageMap[chapterId] || [];
    for (const img of images) {
      downloadTasks.push({
        chapterId,
        url: img.url,
        filename: img.filename
      });
    }
  }

  const chapterImages: Record<number, { data: ArrayBuffer; filename: string }[]> = {};
  for (const chapterId of job.chapterIds) {
    chapterImages[chapterId] = [];
  }

  let downloadedPagesCount = 0;
  let downloadedBytes = 0;
  const startTime = Date.now();

  await runWithConcurrency(downloadTasks, maxImages, async (task) => {
    while (queue.getJob(job.jobId)?.status === DownloadStatus.PAUSED) {
      if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;

    let attempt = 0;
    while (attempt <= maxRetries) {
      if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;
      try {
        const result = await relayToContentScript(tabId, { type: 'fetch-image-blob', url: task.url });
        const b64 = (result as { data: string })?.data;
        if (!b64) throw new Error('No base64 data received');

        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) {
          bytes[j] = binary.charCodeAt(j);
        }

        downloadedBytes += bytes.length;
        downloadedPagesCount += 1;

        chapterImages[task.chapterId].push({
          data: bytes.buffer as ArrayBuffer,
          filename: task.filename
        });

        const elapsedSeconds = (Date.now() - startTime) / 1000 || 0.1;
        const speedVal = (downloadedBytes / (1024 * 1024)) / elapsedSeconds;
        const speed = `${speedVal.toFixed(2)} MB/s`;
        const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(Math.floor(elapsedSeconds % 60)).padStart(2, '0')}`;
        
        const percent = Math.round((downloadedPagesCount / totalPages) * 100);

        const speedBps = downloadedBytes / elapsedSeconds;
        const remainingPages = totalPages - downloadedPagesCount;
        const avgBytesPerPage = downloadedBytes / downloadedPagesCount;
        const remainingBytes = remainingPages * avgBytesPerPage;
        const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;
        const eta = etaSeconds > 0 ? `${Math.floor(etaSeconds / 60)}:${String(Math.floor(etaSeconds % 60)).padStart(2, '0')}` : '';

        broadcastProgress({
          jobId: job.jobId,
          status: DownloadStatus.DOWNLOADING,
          chaptersCompleted,
          chaptersFailed,
          totalChapters: job.chapterIds.length,
          pagesDownloaded: downloadedPagesCount,
          currentPage: `Downloading pages...`,
          percent,
          speed,
          eta,
          elapsed,
          pagesText: `${downloadedPagesCount}/${totalPages}`
        });
        break;
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries) {
          job.errors.push(`Failed to download page ${task.filename} in chapter ${task.chapterId}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        } else {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
        }
      }
    }
  });

  if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;

  try {
    const safeTitle = job.mangaTitle.replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const chapterId of job.chapterIds) {
      if (queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) return;

      const chapterObj = job.chapters?.find(c => c.id === chapterId);
      const rawChapterNum = chapterObj ? chapterObj.chapterNumber : String(chapterId);
      const cleanChapterNum = rawChapterNum.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const chapterFolder = `Chapter_${cleanChapterNum}`;

      const images = chapterImages[chapterId] || [];
      if (images.length === 0) continue;

      if (job.format === 'cbz' || job.format === 'zip') {
        const archiveFn = job.format === 'cbz' ? buildCbzArchive : buildZipArchive;
        const buffers = images.map(img => img.data);
        const result = await archiveFn(chapterFolder, buffers);

        const arrayBuffer = await result.blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const dataUrl = `data:application/octet-stream;base64,${base64}`;
        
        const filename = `${safeTitle}/${chapterFolder}/${chapterFolder}.${job.format}`;
        
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
      } else if (job.format === 'images' || job.format === 'folder') {
        const buffers = images.map(img => img.data);
        const imagesResult = await buildImagesExport(chapterFolder, buffers);
        
        for (const file of imagesResult.files) {
          const base64 = arrayBufferToBase64(file.data);
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          
          const filename = `${safeTitle}/${chapterFolder}/${file.filename}`;
          
          await chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
          });
        }
      } else if (job.format === 'pdf') {
        const buffers = images.map(img => img.data);
        const result = await buildPdfArchive(chapterFolder, buffers);
        const arrayBuffer = await result.blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const dataUrl = `data:application/pdf;base64,${base64}`;
        const filename = `${safeTitle}/${chapterFolder}/${chapterFolder}.pdf`;
        
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
      } else {
        const buffers = images.map(img => img.data);
        const result = await buildZipArchive(chapterFolder, buffers);
        const arrayBuffer = await result.blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const dataUrl = `data:application/octet-stream;base64,${base64}`;
        const filename = `${safeTitle}/${chapterFolder}/${chapterFolder}.zip`;
        
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
      }
    }
  } catch (error) {
    job.errors.push(`Archive error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const finalStatus = chaptersFailed === 0 ? DownloadStatus.COMPLETED : chaptersFailed < job.chapterIds.length ? DownloadStatus.PARTIAL : DownloadStatus.FAILED;
  queue.updateStatus(job.jobId, finalStatus);
  
  const elapsedSeconds = (Date.now() - startTime) / 1000 || 0.1;
  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(Math.floor(elapsedSeconds % 60)).padStart(2, '0')}`;
  
  broadcastProgress({
    jobId: job.jobId,
    status: finalStatus,
    chaptersCompleted,
    chaptersFailed,
    totalChapters: job.chapterIds.length,
    pagesDownloaded: downloadedPagesCount,
    percent: 100,
    elapsed
  });
  broadcastComplete(job.jobId);
  queue.remove(job.jobId);
}

async function processNext(tabId: number): Promise<void> {
  const settings = await loadSettings();
  const maxDownloads = settings.download.maxConcurrentDownloads ?? 3;

  while (activeWorkers < maxDownloads) {
    const next = queue.nextQueued();
    if (!next) break;
    activeWorkers += 1;
    processJob(next, tabId).finally(async () => {
      activeWorkers -= 1;
      const tabs = await chrome.tabs.query({ url: 'https://mangadot.net/*' });
      const activeTabId = tabs[0]?.id || tabId;
      processNext(activeTabId);
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.info('MangaDotNet installed');
  try {
    const tabs = await chrome.tabs.query({ url: 'https://mangadot.net/*' });
    for (const tab of tabs) {
      if (tab.id) await injectContentScript(tab.id);
    }
  } catch (e) {
    console.warn('Could not re-inject content script on install', e);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'detect-url') {
    sendResponse({ ok: true, detection: detectMangaDotNetPage(message.url) });
    return true;
  }

  if (message?.type === 'inject-content') {
    const tabId = message.tabId as number;
    injectContentScript(tabId).then((ok) => sendResponse({ ok }));
    return true;
  }

  if (message?.type === 'start-download') {
    const job: DownloadJob = {
      jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mangaId: message.mangaId,
      mangaTitle: message.mangaTitle || 'Manga',
      chapterIds: message.chapterIds || [],
      chapters: message.chapters || [],
      format: (message.format || 'cbz') as ExportFormat,
      status: DownloadStatus.QUEUED,
      createdAt: Date.now(),
      chaptersCompleted: 0,
      chaptersFailed: 0,
      pagesDownloaded: 0,
      errors: []
    };
    queue.enqueue(job);
    broadcastProgress({
      jobId: job.jobId,
      status: DownloadStatus.QUEUED,
      chaptersCompleted: 0,
      chaptersFailed: 0,
      totalChapters: job.chapterIds.length,
      pagesDownloaded: 0
    });

    // Find the mangadot.net tab to relay through
    chrome.tabs.query({ url: 'https://mangadot.net/*' }).then((tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        processNext(tabId);
      } else {
        queue.updateStatus(job.jobId, DownloadStatus.FAILED);
        job.errors.push('No MangaDotNet tab found');
      }
    });

    sendResponse({ ok: true, jobId: job.jobId });
    return true;
  }

  if (message?.type === 'cancel-download') {
    queue.cancel(message.jobId);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'pause-download') {
    queue.pause(message.jobId);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'resume-download') {
    queue.resume(message.jobId);
    chrome.tabs.query({ url: 'https://mangadot.net/*' }).then((tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) processNext(tabId);
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'get-queue') {
    sendResponse({ ok: true, jobs: queue.getJobs() });
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'loading') return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && tab.url.startsWith('https://mangadot.net/')) {
      await injectContentScript(tabId);
    }
  } catch {
    // tab may have been closed
  }
});

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const subArray = bytes.subarray(i, i + chunk);
    for (let j = 0; j < subArray.length; j++) {
      binary += String.fromCharCode(subArray[j]);
    }
  }
  return btoa(binary);
}

