import { describe, expect, it } from 'vitest';
import { detectMangaDotNetPage, isMangaDotNetUrl } from '../src/core/url-detection';

describe('MangaDotNet URL detection', () => {
  it('accepts only https MangaDotNet URLs', () => {
    expect(isMangaDotNetUrl('https://mangadot.net/')).toBe(true);
    expect(isMangaDotNetUrl('https://mangadot.net/manga/166')).toBe(true);
    expect(isMangaDotNetUrl('http://mangadot.net/manga/166')).toBe(false);
    expect(isMangaDotNetUrl('https://example.com/manga/166')).toBe(false);
  });

  it('extracts manga ID from /manga/{id}', () => {
    expect(detectMangaDotNetPage('https://mangadot.net/manga/166').mangaId).toBe(166);
    expect(detectMangaDotNetPage('https://mangadot.net/manga/166?tab=chapters').pageType).toBe('manga');
  });

  it('extracts manga ID from /{id}/{slug}', () => {
    const result = detectMangaDotNetPage('https://mangadot.net/166/some-slug');
    expect(result.isSupportedOrigin).toBe(true);
    expect(result.pageType).toBe('manga');
    expect(result.mangaId).toBe(166);
  });

  it('distinguishes MangaDotNet pages without manga IDs from wrong-site pages', () => {
    expect(detectMangaDotNetPage('https://mangadot.net/').pageType).toBe('unsupported');
    expect(detectMangaDotNetPage('https://google.com/').pageType).toBe('wrong-origin');
  });
});
