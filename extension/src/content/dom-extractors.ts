import { detectMangaDotNetPage, MANGADOTNET_ORIGIN } from '../core/url-detection';
import type { PageDetectionResult } from '../core/types';

export interface ExtractedPageContext {
  detection: PageDetectionResult;
  title: string;
  coverUrl: string | null;
}

export function extractPageContextFromDocument(doc: Document, url: string): ExtractedPageContext {
  const detection = detectMangaDotNetPage(url);
  return {
    detection,
    title: extractTitle(doc),
    coverUrl: normalizeUrl(extractCoverUrl(doc))
  };
}

function extractTitle(doc: Document): string {
  const heading = doc.querySelector('h1')?.textContent?.trim();
  if (heading) return heading;
  return doc.title.trim();
}

function extractCoverUrl(doc: Document): string | null {
  const metaImage = doc.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]')?.content;
  if (metaImage) return metaImage;

  return doc.querySelector<HTMLImageElement>('img[alt*="cover" i], img[src*="cover" i]')?.getAttribute('src') ?? null;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, MANGADOTNET_ORIGIN).href;
  } catch {
    return null;
  }
}
