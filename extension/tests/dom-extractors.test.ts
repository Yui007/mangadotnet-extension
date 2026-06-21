import { describe, expect, it } from 'vitest';
import { extractPageContextFromDocument } from '../src/content/dom-extractors';

describe('content DOM extraction', () => {
  it('extracts manga context from title, h1, meta cover, and URL', () => {
    document.head.innerHTML = '<meta property="og:image" content="/covers/demo.jpg"><title>Ignored title</title>';
    document.body.innerHTML = '<main><h1>Solo Leveling</h1></main>';

    const context = extractPageContextFromDocument(document, 'https://mangadot.net/manga/166');

    expect(context.detection.pageType).toBe('manga');
    expect(context.detection.mangaId).toBe(166);
    expect(context.title).toBe('Solo Leveling');
    expect(context.coverUrl).toBe('https://mangadot.net/covers/demo.jpg');
  });

  it('falls back to document title and detects unsupported MangaDotNet pages', () => {
    document.head.innerHTML = '<title>MangaDotNet - Search</title>';
    document.body.innerHTML = '';

    const context = extractPageContextFromDocument(document, 'https://mangadot.net/search');

    expect(context.detection.isSupportedOrigin).toBe(true);
    expect(context.detection.pageType).toBe('unsupported');
    expect(context.title).toBe('MangaDotNet - Search');
    expect(context.coverUrl).toBeNull();
  });
});
