import { MANGADOTNET_ORIGIN } from '../core/types';
import type { MangaResult } from '../core/models';
import { normalizeUrl, toInt, toNumber } from '../core/models';

export function parseSearchResponse(data: unknown): MangaResult[] {
  if (!Array.isArray(data)) return [];

  const resultsIndex = data.findIndex((item) => item === 'results');
  const resultRefs = resultsIndex >= 0 ? data[resultsIndex + 1] : null;
  if (!Array.isArray(resultRefs)) return [];

  return resultRefs
    .map((ref) => (typeof ref === 'number' ? data[ref] : null))
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((obj) => resolveMangaObject(data, obj))
    .filter((item): item is MangaResult => item !== null);
}

function resolveMangaObject(data: unknown[], obj: Record<string, unknown>): MangaResult | null {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!/^_\d+$/.test(key)) continue;
    const fieldName = data[Number(key.slice(1))];
    if (typeof fieldName !== 'string') continue;
    resolved[fieldName] = resolveValue(data, value);
  }

  const id = toNumber(resolved.id);
  const title = typeof resolved.title === 'string' ? resolved.title : '';
  if (!id || !title) return null;

  const photo = String(resolved.photo ?? '');
  return {
    id: Math.trunc(id),
    title,
    photo,
    status: String(resolved.status ?? ''),
    rating: toNumber(resolved.avg_rating ?? resolved.rating),
    chapterCount: toInt(resolved.chapter_count),
    genres: Array.isArray(resolved.genres) ? resolved.genres.map(String) : [],
    description: String(resolved.description ?? ''),
    isAdult: Boolean(resolved.is_blurworthy ?? resolved.is_adult),
    coverUrl: normalizeUrl(photo || MANGADOTNET_ORIGIN)
  };
}

function resolveValue(data: unknown[], value: unknown): unknown {
  if (typeof value === 'number' && value >= 0 && value < data.length) {
    const resolved = data[value];
    if (Array.isArray(resolved)) return resolved.map((item) => resolveValue(data, item));
    return resolved;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
