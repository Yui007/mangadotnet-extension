import type { ChapterImages, PageImage } from '../core/models';
import { normalizeUrl, toInt, toNumber } from '../core/models';

export function normalizeChapterImages(data: Record<string, unknown>): ChapterImages {
  return {
    chapter: asRecord(data.chapter),
    manga: asRecord(data.manga),
    images: normalizeImages(data.images),
    prevChapterId: toNumber(data.prev_chapter_id),
    nextChapterId: toNumber(data.next_chapter_id),
    prevVolumeId: toNumber(data.prev_volume_id),
    nextVolumeId: toNumber(data.next_volume_id),
    type: String(data.type ?? 'chapter'),
    volumeNumber: toNumber(data.volume_number),
    source: String(data.source ?? '')
  };
}

function normalizeImages(value: unknown): PageImage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((image) => {
    const filename = String(image.filename ?? '');
    return {
      url: normalizeUrl(image.url),
      width: toInt(image.w ?? image.width),
      height: toInt(image.h ?? image.height),
      filename,
      extension: extensionFromFilename(filename)
    };
  });
}

function extensionFromFilename(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
