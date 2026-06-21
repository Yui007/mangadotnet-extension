import { MANGADOTNET_ORIGIN, type PageDetectionResult } from './types';

export function isMangaDotNetUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && url.hostname === 'mangadot.net';
  } catch {
    return false;
  }
}

export function detectMangaDotNetPage(rawUrl: string | undefined | null): PageDetectionResult {
  const safeUrl = rawUrl ?? '';
  if (!isMangaDotNetUrl(safeUrl)) {
    return { isSupportedOrigin: false, pageType: 'wrong-origin', mangaId: null, url: safeUrl };
  }

  const url = new URL(safeUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const mangaId = extractMangaId(pathParts);

  if (mangaId === null) {
    return { isSupportedOrigin: true, pageType: 'unsupported', mangaId: null, url: url.href };
  }

  return { isSupportedOrigin: true, pageType: 'manga', mangaId, url: url.href };
}

function extractMangaId(pathParts: string[]): number | null {
  if (pathParts[0] === 'manga' && pathParts[1]) {
    return parsePositiveInt(pathParts[1]);
  }

  if (pathParts[0]) {
    return parsePositiveInt(pathParts[0]);
  }

  return null;
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed <= Number.MAX_SAFE_INTEGER && parsed > 0 ? parsed : null;
}

export { MANGADOTNET_ORIGIN };
