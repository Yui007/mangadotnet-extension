import { describe, expect, it } from 'vitest';
import { DownloadJob, DownloadStatus } from '../src/downloads/types';
import { DownloadQueue } from '../src/downloads/queue';

function makeJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    jobId: `job-${Math.random().toString(36).slice(2, 8)}`,
    mangaId: 166,
    mangaTitle: 'Solo Leveling',
    chapterIds: [1, 2],
    format: 'cbz',
    status: DownloadStatus.QUEUED,
    createdAt: Date.now(),
    chaptersCompleted: 0,
    chaptersFailed: 0,
    pagesDownloaded: 0,
    errors: [],
    ...overrides
  };
}

describe('DownloadQueue', () => {
  it('starts with empty queue', () => {
    const queue = new DownloadQueue();
    expect(queue.getJobs()).toHaveLength(0);
    expect(queue.getActiveCount()).toBe(0);
  });

  it('enqueues a job and tracks status', () => {
    const queue = new DownloadQueue();
    const job = makeJob({ jobId: 'test-1' });
    queue.enqueue(job);
    expect(queue.getJobs()).toHaveLength(1);
    expect(queue.getJob('test-1')?.status).toBe(DownloadStatus.QUEUED);
  });

  it('reports active vs queued counts', () => {
    const queue = new DownloadQueue();
    queue.enqueue(makeJob({ jobId: 'j1', status: DownloadStatus.DOWNLOADING }));
    queue.enqueue(makeJob({ jobId: 'j2', status: DownloadStatus.QUEUED }));
    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(1);
  });

  it('can cancel a job', () => {
    const queue = new DownloadQueue();
    queue.enqueue(makeJob({ jobId: 'cancel-1' }));
    queue.cancel('cancel-1');
    expect(queue.getJob('cancel-1')?.status).toBe(DownloadStatus.CANCELLED);
  });

  it('can pause and resume a job', () => {
    const queue = new DownloadQueue();
    queue.enqueue(makeJob({ jobId: 'pr-1', status: DownloadStatus.DOWNLOADING }));
    queue.pause('pr-1');
    expect(queue.getJob('pr-1')?.status).toBe(DownloadStatus.PAUSED);
    queue.resume('pr-1');
    expect(queue.getJob('pr-1')?.status).toBe(DownloadStatus.QUEUED);
  });
});
