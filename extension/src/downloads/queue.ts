import type { DownloadJob, DownloadStatus } from './types';
import { DownloadStatus as Status } from './types';

export class DownloadQueue {
  private jobs = new Map<string, DownloadJob>();

  enqueue(job: DownloadJob): void {
    this.jobs.set(job.jobId, job);
  }

  getJobs(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId);
  }

  getActiveCount(): number {
    return this.getJobs().filter(
      (job) => job.status === Status.DOWNLOADING || job.status === Status.PREPARING || job.status === Status.EXPORTING
    ).length;
  }

  getQueuedCount(): number {
    return this.getJobs().filter((job) => job.status === Status.QUEUED).length;
  }

  updateStatus(jobId: string, status: DownloadStatus): void {
    const job = this.jobs.get(jobId);
    if (job) job.status = status;
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.status = Status.CANCELLED;
  }

  pause(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && (job.status === Status.DOWNLOADING || job.status === Status.QUEUED)) {
      job.status = Status.PAUSED;
    }
  }

  resume(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === Status.PAUSED) {
      job.status = Status.QUEUED;
    }
  }

  remove(jobId: string): void {
    this.jobs.delete(jobId);
  }

  removeCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === Status.COMPLETED || job.status === Status.CANCELLED || job.status === Status.FAILED) {
        this.jobs.delete(id);
      }
    }
  }

  nextQueued(): DownloadJob | undefined {
    return this.getJobs().find((job) => job.status === Status.QUEUED);
  }
}
