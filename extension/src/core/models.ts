import { MANGADOTNET_ORIGIN } from './types';

export interface ScanlatorGroup { id: number; name: string }

export interface MangaResult {
  id: number;
  title: string;
  photo: string;
  status: string;
  rating: number | null;
  chapterCount: number;
  genres: string[];
  description: string;
  isAdult: boolean;
  coverUrl: string;
}

export interface MangaInfo {
  id: number;
  title: string;
  genres: string[];
  status: string;
  description: string;
  authors: string[];
  artists: string[];
  chapterCount: number;
  rating: number | null;
  avgRating: number | null;
  ratingCount: number;
  altTitles: string[];
  isAdult: boolean;
  countryOfOrigin: string;
  year: number | null;
  photo: string;
  bannerImage: string | null;
  dateAdded: string;
  hiatus: string;
  sourceUrl: string | null;
  scanlationGroup: string | null;
  isBlurworthy: boolean;
  contentRating: string;
  isHot: boolean;
  isPopular: boolean;
  viewCount: number;
  commentCount: number;
  trackedCount: number;
  lastChapterDate: string | null;
  updateDay: string | null;
  reviewCount: number;
  mangaupdatesId: string | null;
  anilistId: number | null;
  mangadexId: string | null;
  malId: number | null;
  kitsuId: number | null;
  mangabakaId: number | null;
  totalChapters: number;
  firstChapterId: number | null;
  firstChapterSource: string | null;
  statusText: string;
  dateAddedFormatted: string;
  coverUrl: string;
  bannerUrl: string | null;
}

export interface Chapter {
  id: number;
  chapterNumber: string;
  volumeNumber: string | null;
  chapterTitle: string | null;
  language: string;
  pageCount: number;
  groupId: number;
  groupName: string | null;
  groups: ScanlatorGroup[];
  scanlatorName: string | null;
  source: string;
  uploaderId: string | null;
  uploaderUsername: string | null;
  uploaderUploadStatus: string | null;
  dateAdded: string | null;
  commentCount: number;
}

export interface Volume {
  id: number;
  volumeNumber: number;
  pageCount: number;
  coverUrl: string;
  groupName: string | null;
  uploaderUsername: string | null;
  groups: Record<string, unknown>[];
}

export interface PageImage {
  url: string;
  width: number;
  height: number;
  filename: string;
  extension: string;
}

export interface ChapterImages {
  chapter: Record<string, unknown>;
  manga: Record<string, unknown>;
  images: PageImage[];
  prevChapterId: number | null;
  nextChapterId: number | null;
  prevVolumeId: number | null;
  nextVolumeId: number | null;
  type: string;
  volumeNumber: number | null;
  source: string;
}

export function normalizeUrl(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return '';
  try {
    return new URL(text, MANGADOTNET_ORIGIN).href;
  } catch {
    return text;
  }
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toInt(value: unknown, fallback = 0): number {
  const number = toNumber(value);
  return number === null ? fallback : Math.trunc(number);
}

export function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toNullableString(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}
