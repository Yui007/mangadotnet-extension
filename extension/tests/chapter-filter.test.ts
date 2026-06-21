import { describe, expect, it } from 'vitest';
import type { Chapter } from '../src/core/models';
import { filterAndDeduplicateChapters, getAvailableGroups, getAvailableLanguages } from '../src/core/chapter-filter';

function chapter(overrides: Partial<Chapter>): Chapter {
  return {
    id: 0,
    chapterNumber: '0',
    volumeNumber: null,
    chapterTitle: null,
    language: 'en',
    pageCount: 0,
    groupId: 0,
    groupName: null,
    groups: [],
    scanlatorName: null,
    source: 'scraper',
    uploaderId: null,
    uploaderUsername: null,
    uploaderUploadStatus: null,
    dateAdded: null,
    commentCount: 0,
    ...overrides
  };
}

describe('ChapterFilter parity', () => {
  it('filters by language then deduplicates by user upload, group, pages, and recency priority', () => {
    const chapters = [
      chapter({ id: 1, chapterNumber: '1', language: 'en', pageCount: 10, groupName: 'A', source: 'scraper', dateAdded: '2024-01-01' }),
      chapter({ id: 2, chapterNumber: '1', language: 'en', pageCount: 8, groupName: null, source: 'user', dateAdded: '2024-01-02' }),
      chapter({ id: 3, chapterNumber: '1', language: 'es', pageCount: 30, groupName: 'ES', source: 'user', dateAdded: '2024-01-03' }),
      chapter({ id: 4, chapterNumber: '2', volumeNumber: '1', language: 'en', pageCount: 9, groupName: 'A', source: 'scraper', dateAdded: '2024-01-01' }),
      chapter({ id: 5, chapterNumber: '2', volumeNumber: '1', language: 'en', pageCount: 12, groupName: 'B', source: 'scraper', dateAdded: '2024-01-02' })
    ];

    const result = filterAndDeduplicateChapters(chapters, { language: 'en', preferUserUploaded: true });

    expect(result.map((item) => item.id)).toEqual([5, 2]);
  });

  it('can disable user-upload preference and then prefer grouped release with more pages', () => {
    const chapters = [
      chapter({ id: 1, chapterNumber: '1', pageCount: 6, groupName: null, source: 'user', dateAdded: '2024-01-03' }),
      chapter({ id: 2, chapterNumber: '1', pageCount: 12, groupName: 'Group', source: 'scraper', dateAdded: '2024-01-01' })
    ];

    expect(filterAndDeduplicateChapters(chapters, { preferUserUploaded: false }).map((item) => item.id)).toEqual([2]);
  });

  it('filters by group id or partial group name before deduplicating', () => {
    const chapters = [
      chapter({ id: 1, chapterNumber: '1', groupId: 10, groupName: 'Alpha Team', pageCount: 10 }),
      chapter({ id: 2, chapterNumber: '1', groupId: 20, groupName: 'Beta Team', pageCount: 20 }),
      chapter({ id: 3, chapterNumber: '2', groupId: 20, groupName: 'Beta Team', pageCount: 8 })
    ];

    expect(filterAndDeduplicateChapters(chapters, { groupId: 20 }).map((item) => item.id)).toEqual([2, 3]);
    expect(filterAndDeduplicateChapters(chapters, { groupName: 'alpha' }).map((item) => item.id)).toEqual([1]);
  });

  it('sorts selected chapters by volume then chapter number with null volumes last', () => {
    const chapters = [
      chapter({ id: 3, chapterNumber: '3', volumeNumber: null }),
      chapter({ id: 2, chapterNumber: '2', volumeNumber: '1' }),
      chapter({ id: 1, chapterNumber: '1', volumeNumber: '1' })
    ];

    expect(filterAndDeduplicateChapters(chapters).map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('reports available language and group counts', () => {
    const chapters = [
      chapter({ id: 1, language: 'en', groupId: 1, groupName: 'A' }),
      chapter({ id: 2, language: 'en', groupId: 1, groupName: 'A' }),
      chapter({ id: 3, language: 'es', groupId: 2, groupName: 'B' })
    ];

    expect(getAvailableLanguages(chapters)).toEqual([{ code: 'en', count: 2 }, { code: 'es', count: 1 }]);
    expect(getAvailableGroups(chapters, 'en')).toEqual([{ id: 1, name: 'A', chapterCount: 2 }]);
  });
});
