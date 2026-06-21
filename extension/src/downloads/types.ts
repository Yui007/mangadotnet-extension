import type { ExportFormat } from '../storage/settings';

export enum DownloadStatus {
  QUEUED = 'queued',
  PREPARING = 'preparing',
  DOWNLOADING = 'downloading',
  EXPORTING = 'exporting',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export interface DownloadJob {
  jobId: string;
  mangaId: number;
  mangaTitle: string;
  coverUrl?: string;
  chapterIds: number[];
  chapterNumbers?: number[];
  chapters?: { id: number; chapterNumber: string }[];
  format: ExportFormat;
  quality?: string;
  language?: string;
  groupName?: string | null;
  createdAt: number;
  status: DownloadStatus;
  chaptersCompleted: number;
  chaptersFailed: number;
  pagesDownloaded: number;
  errors: string[];
}

export interface ChapterDownloadResult {
  chapterId: number;
  success: boolean;
  pagesDownloaded: number;
  error?: string;
}

export interface DownloadProgress {
  jobId: string;
  status: DownloadStatus;
  chaptersCompleted: number;
  chaptersFailed: number;
  totalChapters: number;
  pagesDownloaded: number;
  currentPage?: string;
  speed?: string;
  eta?: string;
  percent?: number;
  elapsed?: string;
  pagesText?: string;
}
