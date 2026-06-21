import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/storage/settings';

describe('settings defaults', () => {
  it('mirrors browser-appropriate MangaDotNet defaults', () => {
    expect(DEFAULT_SETTINGS.defaultFormat).toBe('cbz');
    expect(DEFAULT_SETTINGS.defaultLanguage).toBe('en');
    expect(DEFAULT_SETTINGS.preferUserUploaded).toBe(true);
    expect(DEFAULT_SETTINGS.download.maxConcurrentChapters).toBe(4);
    expect(DEFAULT_SETTINGS.download.maxConcurrentImages).toBe(8);
    expect(DEFAULT_SETTINGS.download.maxRetries).toBe(3);
    expect(DEFAULT_SETTINGS.download.timeout).toBe(30);
    expect(DEFAULT_SETTINGS.quality.default).toBe('original');
    expect(DEFAULT_SETTINGS.cache.maxSizeMb).toBe(50);
    expect(DEFAULT_SETTINGS.ui.theme).toBe('nebula-dark');
  });
});
