import '../src/ui/styles/tokens.css';
import './popup.css';
import { getPageContextWithRetries, chromeActiveTabDependencies } from '../src/ui/active-tab';
import { filterAndDeduplicateChapters, getAvailableLanguages, getAvailableGroups } from '../src/core/chapter-filter';
import { sanitizeFilename } from '../src/core/filename';
import { DEFAULT_SETTINGS, type ExportFormat, loadSettings, saveSettings } from '../src/storage/settings';
import type { Chapter, MangaInfo } from '../src/core/models';
import type { ExtractedPageContext } from '../src/content/dom-extractors';
import { detectMangaDotNetPage } from '../src/core/url-detection';

type TabId = 'info' | 'chapters' | 'download' | 'settings';

const app = document.querySelector<HTMLDivElement>('#app');

let currentManga: MangaInfo | null = null;
let currentChapters: Chapter[] = [];
let selectedChapterIds = new Set<number>();
let selectedLanguage: string | null = null;
let selectedGroupId: number | null = null;
let activeTab: TabId = 'info';
let mangaTabId: number | null = null;

async function savePopupState() {
  try {
    await chrome.storage.local.set({
      'popup-state': {
        mangaId: currentManga?.id,
        currentManga,
        currentChapters,
        selectedChapterIds: Array.from(selectedChapterIds),
        selectedLanguage,
        selectedGroupId,
        activeTab
      }
    });
  } catch {}
}

function render() {
  if (!app) return;
  app.innerHTML = `
    <main class="popup-shell">
      <header class="app-header">
        <span class="status-pill">MangaDotNet</span>
      </header>
      <nav class="tab-nav">
        <button class="tab-btn ${activeTab === 'info' ? 'active' : ''}" data-tab="info">Info</button>
        <button class="tab-btn ${activeTab === 'chapters' ? 'active' : ''}" data-tab="chapters">Chapters</button>
        <button class="tab-btn ${activeTab === 'download' ? 'active' : ''}" data-tab="download">Download</button>
        <button class="tab-btn ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">Settings</button>
      </nav>
      <section class="tab-content hidden" id="tab-info"></section>
      <section class="tab-content hidden" id="tab-chapters"></section>
      <section class="tab-content hidden" id="tab-download"></section>
      <section class="tab-content hidden" id="tab-settings"></section>
    </main>
  `;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab as TabId;
      activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderActiveTab();
      savePopupState();
    });
  });
}

function renderActiveTab() {
  if (!currentManga) return;
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
  switch (activeTab) {
    case 'info': renderInfoTab(); break;
    case 'chapters': renderChaptersTab(); break;
    case 'download': void renderDownloadTab(); break;
    case 'settings': void renderSettingsTab(); break;
  }
}

function showStateError(title: string, messageHtml: string) {
  if (!app) return;
  app.innerHTML = `
    <main class="popup-shell" style="justify-content: center; align-items: center; min-height: 400px;">
      <section class="card" aria-live="polite" style="width: 100%;">
        <h2>${title}</h2>
        ${messageHtml}
      </section>
    </main>
  `;
}

async function detectActiveTab() {
  const result = await getPageContextWithRetries(chromeActiveTabDependencies, { retries: 5, reloadOnFailure: false });

  if (result.state === 'content-unavailable') {
    const tab = await chrome.tabs.query({ url: 'https://mangadot.net/*' });
    if (tab[0]?.id) {
      await sendRuntimeMessageWithRetry({ type: 'inject-content', tabId: tab[0].id });
      await new Promise((r) => setTimeout(r, 500));
      const retry = await getPageContextWithRetries(chromeActiveTabDependencies, { retries: 3, reloadOnFailure: false });
      if (retry.state === 'ready') {
        await handleReady(retry.context);
        return;
      }
    }
  }

  if (result.state === 'wrong-origin') {
    showStateError(
      'Open MangaDotNet to start',
      `<p class="muted">This extension activates only on https://mangadot.net/. Open a manga page, then click the extension again.</p>
       <a class="button-link" href="https://mangadot.net/" target="_blank" rel="noreferrer">Open MangaDotNet</a>`
    );
    return;
  }

  if (result.state !== 'ready') {
    showStateError(
      result.state === 'unsupported' ? 'No manga detected' : 'Waiting for MangaDotNet session',
      `<p class="muted">${result.reason}</p>`
    );
    return;
  }

  await handleReady(result.context);
}

async function handleReady(rawContext: unknown) {
  const payload = rawContext as { ok?: boolean; context?: ExtractedPageContext };
  const context = payload.context;
  if (!context?.detection.mangaId) {
    showStateError(
      'No manga detected',
      '<p class="muted">This MangaDotNet page does not expose a manga ID yet. Open a manga details or reader page.</p>'
    );
    return;
  }

  await loadMangaData(context.detection.mangaId);
}

async function loadMangaData(mangaId: number) {
  try {
    const tab = await chrome.tabs.query({ url: 'https://mangadot.net/*' });
    const tabId = tab[0]?.id;
    if (!tabId) throw new Error('MangaDotNet tab not found. Keep the tab open.');
    mangaTabId = tabId;

    const [manga, chapters] = await Promise.all([
      chrome.tabs.sendMessage(tabId, { type: 'fetch-manga', mangaId }),
      chrome.tabs.sendMessage(tabId, { type: 'fetch-chapters', mangaId })
    ]);

    if (!manga.ok) throw new Error(manga.error || 'Failed to fetch manga info');
    if (!chapters.ok) throw new Error(chapters.error || 'Failed to fetch chapters');

    currentManga = manga.manga as MangaInfo;
    currentChapters = chapters.chapters as Chapter[];
    selectedChapterIds = new Set(currentChapters.map((ch) => ch.id));

    render();
    savePopupState();
    renderActiveTab();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showStateError('Failed to load manga', `<p class="muted">${message}</p>`);
  }
}

function renderInfoTab() {
  const tab = document.querySelector<HTMLElement>('#tab-info');
  if (!tab || !currentManga) return;
  tab.classList.remove('hidden');
  tab.innerHTML = `
    <div class="manga-detail">
      ${currentManga.coverUrl ? `<img class="manga-cover-large" src="${escapeHtml(currentManga.coverUrl)}" alt="Cover" />` : '<div class="manga-cover-large placeholder">Cover</div>'}
      <div class="manga-detail-info">
        <h2>${escapeHtml(currentManga.title)}</h2>
        <div class="manga-meta">
          <span class="badge">${escapeHtml(currentManga.status || 'Unknown')}</span>
          <span class="badge">${currentManga.chapterCount} chapters</span>
          ${currentManga.avgRating ? `<span class="badge">★ ${currentManga.avgRating.toFixed(1)}</span>` : ''}
        </div>
        <p class="description">${escapeHtml(currentManga.description)}</p>
        ${currentManga.authors.length ? `<p class="muted"><strong>Authors:</strong> ${escapeHtml(currentManga.authors.join(', '))}</p>` : ''}
        ${currentManga.artists.length ? `<p class="muted"><strong>Artists:</strong> ${escapeHtml(currentManga.artists.join(', '))}</p>` : ''}
        ${currentManga.genres.length ? `<p class="muted"><strong>Genres:</strong> ${escapeHtml(currentManga.genres.join(', '))}</p>` : ''}
      </div>
    </div>
  `;
}

function renderChaptersTab() {
  const tab = document.querySelector<HTMLElement>('#tab-chapters');
  if (!tab) return;
  tab.classList.remove('hidden');

  const languages = getAvailableLanguages(currentChapters);
  const groups = getAvailableGroups(currentChapters);
  const filtered = filterAndDeduplicateChapters(currentChapters, {
    language: selectedLanguage,
    groupId: selectedGroupId
  });

  tab.innerHTML = `
    <h2>Chapters (${filtered.length})</h2>
    <div class="chapter-controls">
      <select id="language-select" class="select">
        <option value="">All Languages</option>
        ${languages.map((lang) => `<option value="${lang.code}" ${selectedLanguage === lang.code ? 'selected' : ''}>${lang.code.toUpperCase()} (${lang.count})</option>`).join('')}
      </select>
      <select id="group-select" class="select">
        <option value="">All Groups</option>
        ${groups.map((g) => `<option value="${g.id}" ${selectedGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)} (${g.chapterCount})</option>`).join('')}
      </select>
    </div>
    <div class="chapter-controls">
      <button id="select-all" type="button" class="btn-secondary">Select All</button>
      <button id="select-none" type="button" class="btn-secondary">None</button>
      <span class="muted">${selectedChapterIds.size} selected</span>
    </div>
    <div class="chapter-list" id="chapter-list">
      ${filtered.map((ch) => `
        <label class="chapter-row">
          <input type="checkbox" class="chapter-checkbox" data-id="${ch.id}" ${selectedChapterIds.has(ch.id) ? 'checked' : ''} />
          <span class="chapter-number">Ch. ${ch.chapterNumber}</span>
          <span class="chapter-title">${escapeHtml(ch.chapterTitle || 'Untitled')}</span>
          <span class="badge badge-small">${ch.language.toUpperCase()}</span>
          ${ch.groupName ? `<span class="badge badge-small badge-group">${escapeHtml(ch.groupName)}</span>` : ''}
        </label>
      `).join('')}
    </div>
  `;

  document.querySelector('#language-select')?.addEventListener('change', (e) => {
    selectedLanguage = (e.target as HTMLSelectElement).value || null;
    renderChaptersTab();
    savePopupState();
  });

  document.querySelector('#group-select')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    selectedGroupId = val ? Number(val) : null;
    renderChaptersTab();
    savePopupState();
  });

  document.querySelector('#select-all')?.addEventListener('click', () => {
    selectedChapterIds = new Set(filtered.map((ch) => ch.id));
    renderChaptersTab();
    savePopupState();
  });

  document.querySelector('#select-none')?.addEventListener('click', () => {
    selectedChapterIds = new Set();
    renderChaptersTab();
    savePopupState();
  });

  document.querySelectorAll('.chapter-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const id = Number((e.target as HTMLInputElement).dataset.id);
      if ((e.target as HTMLInputElement).checked) {
        selectedChapterIds.add(id);
      } else {
        selectedChapterIds.delete(id);
      }
      savePopupState();
    });
  });
}

async function renderDownloadTab() {
  const tab = document.querySelector<HTMLElement>('#tab-download');
  if (!tab) return;
  tab.classList.remove('hidden');

  const filtered = filterAndDeduplicateChapters(currentChapters, {
    language: selectedLanguage,
    groupId: selectedGroupId
  });
  const selectableCount = filtered.filter((ch) => selectedChapterIds.has(ch.id)).length;

  tab.innerHTML = `
    <h2>Download</h2>
    <div class="download-summary-row" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
      <span class="muted">${selectableCount} chapters selected.</span>
      <button id="download-btn" type="button" class="btn-primary" style="width: auto; padding: 8px 16px;" ${selectableCount === 0 ? 'disabled' : ''}>
        Download Selected
      </button>
    </div>
    
    <h3>Active Queue</h3>
    <div id="download-queue" class="download-queue-list">
      <div class="muted text-center" style="padding: 20px 0;">Loading queue...</div>
    </div>
  `;

  document.querySelector('#download-btn')?.addEventListener('click', startDownload);

  try {
    const response = await sendRuntimeMessageWithRetry({ type: 'get-queue' }) as { ok: boolean; jobs?: any[] };
    const jobs = response?.jobs || [];
    renderJobsList(jobs);
  } catch (e) {
    const queueEl = document.querySelector('#download-queue');
    if (queueEl) queueEl.innerHTML = '<div class="muted text-center">Failed to load queue.</div>';
  }
}

function renderJobsList(jobs: any[]) {
  const queueEl = document.querySelector('#download-queue');
  if (!queueEl) return;

  if (jobs.length === 0) {
    queueEl.innerHTML = '<div class="muted text-center" style="padding: 20px 0;">No active or queued downloads.</div>';
    return;
  }

  queueEl.innerHTML = jobs.map((job) => {
    const percent = job.percent ?? 0;
    const statusText = job.status === 'queued' ? 'Queued' : 
                       job.status === 'paused' ? 'Paused' :
                       job.status === 'completed' ? 'Completed' :
                       job.status === 'failed' ? 'Failed' :
                       job.status === 'preparing' ? (job.currentPage || 'Preparing...') :
                       `⬇ ${job.speed || '0 MB/s'} | ⏱ ${job.elapsed || '00:00'} | 📦 ${job.pagesText || ''}`;
    
    const showActions = job.status === 'downloading' || job.status === 'queued' || job.status === 'paused' || job.status === 'preparing';

    return `
      <div class="download-job" id="job-${job.jobId}">
        <div class="job-header">
          <span class="job-title" title="${escapeHtml(job.mangaTitle)}">${escapeHtml(job.mangaTitle)}</span>
          <span class="job-percent">${percent}%</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
        <div class="job-footer">
          <span class="job-stats">${statusText}</span>
          <div class="job-actions">
            ${showActions ? `
              <button class="job-action-btn pause-btn" data-id="${job.jobId}">${job.status === 'paused' ? '▶' : '⏸'}</button>
              <button class="job-action-btn cancel-btn" data-id="${job.jobId}">✕</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  queueEl.querySelectorAll('.pause-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const jobId = (btn as HTMLElement).dataset.id;
      const isPaused = btn.textContent === '▶';
      btn.textContent = isPaused ? '⏸' : '▶';
      await chrome.runtime.sendMessage({ type: isPaused ? 'resume-download' : 'pause-download', jobId });
      const response = await chrome.runtime.sendMessage({ type: 'get-queue' });
      renderJobsList(response?.jobs || []);
    });
  });

  queueEl.querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const jobId = (btn as HTMLElement).dataset.id;
      await chrome.runtime.sendMessage({ type: 'cancel-download', jobId });
      const response = await chrome.runtime.sendMessage({ type: 'get-queue' });
      renderJobsList(response?.jobs || []);
    });
  });
}

function updateJobProgressUI(progress: any) {
  const jobEl = document.querySelector(`#job-${progress.jobId}`);
  if (!jobEl) {
    chrome.runtime.sendMessage({ type: 'get-queue' }).then((response) => {
      renderJobsList(response?.jobs || []);
    }).catch(() => {});
    return;
  }

  const percentEl = jobEl.querySelector('.job-percent');
  if (percentEl) percentEl.textContent = `${progress.percent ?? 0}%`;

  const barEl = jobEl.querySelector('.progress-bar') as HTMLElement;
  if (barEl) barEl.style.width = `${progress.percent ?? 0}%`;

  const statsEl = jobEl.querySelector('.job-stats');
  if (statsEl) {
    const statusText = progress.status === 'queued' ? 'Queued' : 
                       progress.status === 'paused' ? 'Paused' :
                       progress.status === 'completed' ? 'Completed' :
                       progress.status === 'failed' ? 'Failed' :
                       progress.status === 'preparing' ? (progress.currentPage || 'Preparing...') :
                       `⬇ ${progress.speed || '0 MB/s'} | ⏱ ${progress.elapsed || '00:00'} | 📦 ${progress.pagesText || ''}`;
    statsEl.textContent = statusText;
  }
  
  if (progress.status === 'completed' || progress.status === 'failed') {
    const actionsEl = jobEl.querySelector('.job-actions');
    if (actionsEl) actionsEl.innerHTML = '';
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'download-progress' && activeTab === 'download') {
    updateJobProgressUI(message.progress);
  }
  if (message?.type === 'download-complete' && activeTab === 'download') {
    chrome.runtime.sendMessage({ type: 'get-queue' }).then((response) => {
      renderJobsList(response?.jobs || []);
    }).catch(() => {});
  }
});

async function renderSettingsTab() {
  const tab = document.querySelector<HTMLElement>('#tab-settings');
  if (!tab) return;
  tab.classList.remove('hidden');

  const settings = await loadSettings();

  tab.innerHTML = `
    <h2>Settings</h2>
    <div class="settings-row">
      <label for="settings-format">Default Format</label>
      <select id="settings-format" class="select">
        <option value="cbz" ${settings.defaultFormat === 'cbz' ? 'selected' : ''}>CBZ</option>
        <option value="zip" ${settings.defaultFormat === 'zip' ? 'selected' : ''}>ZIP</option>
        <option value="pdf" ${settings.defaultFormat === 'pdf' ? 'selected' : ''}>PDF</option>
        <option value="images" ${settings.defaultFormat === 'images' ? 'selected' : ''}>Images</option>
      </select>
    </div>
    <div class="settings-row">
      <label for="settings-quality">Image Quality</label>
      <select id="settings-quality" class="select">
        <option value="low" ${settings.quality.default === 'low' ? 'selected' : ''}>Low</option>
        <option value="medium" ${settings.quality.default === 'medium' ? 'selected' : ''}>Medium</option>
        <option value="high" ${settings.quality.default === 'high' ? 'selected' : ''}>High</option>
        <option value="original" ${settings.quality.default === 'original' ? 'selected' : ''}>Original</option>
      </select>
    </div>
    <div class="settings-row">
      <label for="max-concurrent-downloads">Max Concurrent Downloads</label>
      <input type="number" id="max-concurrent-downloads" class="select" min="1" max="10" value="${settings.download.maxConcurrentDownloads ?? 3}" />
    </div>
    <div class="settings-row">
      <label for="max-concurrent-chapters">Max Concurrent Chapters</label>
      <input type="number" id="max-concurrent-chapters" class="select" min="1" max="20" value="${settings.download.maxConcurrentChapters}" />
    </div>
    <div class="settings-row">
      <label for="max-concurrent-images">Max Concurrent Images</label>
      <input type="number" id="max-concurrent-images" class="select" min="1" max="50" value="${settings.download.maxConcurrentImages}" />
    </div>
    <div class="settings-row">
      <label for="max-retries">Max Retries</label>
      <input type="number" id="max-retries" class="select" min="0" max="10" value="${settings.download.maxRetries}" />
    </div>
    <div class="settings-row">
      <label for="retry-delay">Retry Delay (seconds)</label>
      <input type="number" id="retry-delay" class="select" min="1" max="60" value="${settings.download.retryDelay}" />
    </div>
    <div class="settings-row">
      <label for="delete-images">
        <input type="checkbox" id="delete-images" ${settings.quality.convertWebp ? 'checked' : ''} /> Delete images after export
      </label>
    </div>
    
    <button id="save-settings-btn" class="btn-primary" style="margin-top: 15px;">Save Settings</button>
    <div id="settings-status" class="muted" style="margin-top: 10px; text-align: center; display: none;"></div>
  `;

  document.querySelector('#save-settings-btn')?.addEventListener('click', async () => {
    const format = document.querySelector<HTMLSelectElement>('#settings-format')?.value as ExportFormat;
    const quality = document.querySelector<HTMLSelectElement>('#settings-quality')?.value as any;
    const maxConcurrentDownloads = Number(document.querySelector<HTMLInputElement>('#max-concurrent-downloads')?.value || 3);
    const maxConcurrentChapters = Number(document.querySelector<HTMLInputElement>('#max-concurrent-chapters')?.value || 4);
    const maxConcurrentImages = Number(document.querySelector<HTMLInputElement>('#max-concurrent-images')?.value || 8);
    const maxRetries = Number(document.querySelector<HTMLInputElement>('#max-retries')?.value || 3);
    const retryDelay = Number(document.querySelector<HTMLInputElement>('#retry-delay')?.value || 2);
    const deleteImages = document.querySelector<HTMLInputElement>('#delete-images')?.checked || false;

    const newSettings = {
      ...settings,
      defaultFormat: format,
      quality: {
        ...settings.quality,
        default: quality,
        convertWebp: deleteImages
      },
      download: {
        ...settings.download,
        maxConcurrentDownloads,
        maxConcurrentChapters,
        maxConcurrentImages,
        maxRetries,
        retryDelay
      }
    };

    await saveSettings(newSettings);
    
    const statusEl = document.querySelector<HTMLElement>('#settings-status');
    if (statusEl) {
      statusEl.textContent = 'Settings saved successfully!';
      statusEl.style.display = 'block';
      statusEl.style.color = '#2ecc71';
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 2000);
    }
  });
}

async function sendRuntimeMessageWithRetry(message: unknown, maxRetries = 3, delayMs = 200): Promise<unknown> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}

async function startDownload() {
  if (!currentManga || !mangaTabId || selectedChapterIds.size === 0) return;

  const btn = document.querySelector<HTMLButtonElement>('#download-btn');
  if (btn) {
    btn.textContent = 'Starting…';
    btn.disabled = true;
  }

  try {
    const settings = await loadSettings();
    const format = settings.defaultFormat || 'cbz';

    await sendRuntimeMessageWithRetry({
      type: 'start-download',
      mangaId: currentManga.id,
      mangaTitle: sanitizeFilename(currentManga.title),
      chapterIds: Array.from(selectedChapterIds),
      chapters: Array.from(selectedChapterIds).map(id => {
        const ch = currentChapters.find(c => c.id === id);
        return {
          id: id,
          chapterNumber: ch ? String(ch.chapterNumber) : String(id)
        };
      }),
      format: format
    });

    if (btn) {
      btn.textContent = 'Download queued!';
      setTimeout(() => {
        btn.textContent = 'Download Selected';
        btn.disabled = false;
        
        // Switch to the download tab
        activeTab = 'download';
        document.querySelectorAll('.tab-btn').forEach((b) => {
          if ((b as HTMLElement).dataset.tab === 'download') b.classList.add('active');
          else b.classList.remove('active');
        });
        renderActiveTab();
        savePopupState();
      }, 1000);
    }
  } catch (error) {
    if (btn) {
      btn.textContent = 'Download failed';
      setTimeout(() => {
        btn.textContent = 'Download Selected';
        btn.disabled = false;
      }, 2000);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function restoreStateOrDetect() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabUrl = tabs[0]?.url || '';
    const detection = detectMangaDotNetPage(activeTabUrl);

    const savedState = await chrome.storage.local.get('popup-state');
    const state = savedState['popup-state'];

    if (detection.mangaId && state && state.mangaId === detection.mangaId) {
      currentManga = state.currentManga;
      currentChapters = state.currentChapters;
      selectedChapterIds = new Set(state.selectedChapterIds);
      selectedLanguage = state.selectedLanguage;
      selectedGroupId = state.selectedGroupId;
      activeTab = state.activeTab || 'info';
      mangaTabId = tabs[0]?.id || null;

      render();
      document.querySelectorAll('.tab-btn').forEach((btn) => {
        const tab = (btn as HTMLElement).dataset.tab as TabId;
        if (tab === activeTab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      renderActiveTab();
      return;
    }
  } catch (e) {
    console.warn('Failed to restore popup state:', e);
  }

  await detectActiveTab();
}

void restoreStateOrDetect();
