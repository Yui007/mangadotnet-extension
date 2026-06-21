import type { DownloadJob, DownloadProgress } from './types';
import { DownloadStatus } from './types';
import { DownloadQueue } from './queue';
import type { MangaDotNetApiClient } from '../api/client';

export type ProgressCallback = (progress: DownloadProgress) => void;
export type DownloadCompleteCallback = (jobId: string) => void;

export class DownloadEngine {
  private queue: DownloadQueue;
  private client: MangaDotNetApiClient;
  private onProgress?: ProgressCallback;
  private onComplete?: DownloadCompleteCallback;
  private maxConcurrentChapters: number;
  private maxConcurrentImages: number;
  private maxRetries: number;
  private retryDelay: number;
  private activeWorkers = 0;

  constructor(
    client: MangaDotNetApiClient,
    options: {
      maxConcurrentChapters?: number;
      maxConcurrentImages?: number;
      maxRetries?: number;
      retryDelay?: number;
      onProgress?: ProgressCallback;
      onComplete?: DownloadCompleteCallback;
    } = {}
  ) {
    this.queue = new DownloadQueue();
    this.client = client;
    this.maxConcurrentChapters = options.maxConcurrentChapters ?? 4;
    this.maxConcurrentImages = options.maxConcurrentImages ?? 8;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
  }

  getQueue(): DownloadQueue {
    return this.queue;
  }

  enqueueJob(job: DownloadJob): void {
    this.queue.enqueue(job);
    this.onProgress?.({
      jobId: job.jobId,
      status: DownloadStatus.QUEUED,
      chaptersCompleted: 0,
      chaptersFailed: 0,
      totalChapters: job.chapterIds.length,
      pagesDownloaded: 0
    });
    this.processNext();
  }

  cancelJob(jobId: string): void {
    this.queue.cancel(jobId);
  }

  pauseJob(jobId: string): void {
    this.queue.pause(jobId);
  }

  resumeJob(jobId: string): void {
    this.queue.resume(jobId);
    this.processNext();
  }

  private processNext(): void {
    while (this.activeWorkers < this.maxConcurrentChapters) {
      const next = this.queue.nextQueued();
      if (!next) break;
      this.activeWorkers += 1;
      this.processJob(next).finally(() => {
        this.activeWorkers -= 1;
        this.processNext();
      });
    }
  }

  private async processJob(job: DownloadJob): Promise<void> {
    this.queue.updateStatus(job.jobId, DownloadStatus.DOWNLOADING);
    let chaptersCompleted = 0;
    let chaptersFailed = 0;
    let pagesDownloaded = 0;

    for (const chapterId of job.chapterIds) {
      if (this.queue.getJob(job.jobId)?.status === DownloadStatus.CANCELLED) break;

      try {
        this.onProgress?.({
          jobId: job.jobId,
          status: DownloadStatus.DOWNLOADING,
          chaptersCompleted,
          chaptersFailed,
          totalChapters: job.chapterIds.length,
          pagesDownloaded,
          currentPage: `Chapter ${chapterId}`
        });

        const images = await this.fetchChapterImages(chapterId);
        pagesDownloaded += images.length;
        chaptersCompleted += 1;
      } catch (error) {
        chaptersFailed += 1;
        const msg = error instanceof Error ? error.message : String(error);
        job.errors.push(`Chapter ${chapterId}: ${msg}`);
      }
    }

    const finalStatus = chaptersFailed === 0 ? DownloadStatus.COMPLETED : DownloadStatus.PARTIAL;
    this.queue.updateStatus(job.jobId, finalStatus);
    this.onProgress?.({
      jobId: job.jobId,
      status: finalStatus,
      chaptersCompleted,
      chaptersFailed,
      totalChapters: job.chapterIds.length,
      pagesDownloaded
    });
    this.onComplete?.(job.jobId);
  }

  private async fetchChapterImages(chapterId: number): Promise<string[]> {
    const chapterImages = await this.client.getImages(chapterId);
    return chapterImages.images.map((image) => image.url);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
