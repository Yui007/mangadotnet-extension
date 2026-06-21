import { describe, expect, it } from 'vitest';
import type { Chapter } from '../src/core/models';
import { parseChapterRange, selectChapters } from '../src/core/chapter-selection';

function chapter(id: number, chapterNumber: string): Chapter {
  return {
    id,
    chapterNumber,
    volumeNumber: null,
    chapterTitle: null,
    language: 'en',
    pageCount: 1,
    groupId: 0,
    groupName: null,
    groups: [],
    scanlatorName: null,
    source: 'user',
    uploaderId: null,
    uploaderUsername: null,
    uploaderUploadStatus: null,
    dateAdded: null,
    commentCount: 0
  };
}

describe('chapter selection engine', () => {
  const chapters = [chapter(1, '1'), chapter(2, '2'), chapter(3, '3'), chapter(10, '10'), chapter(11, '11')];

  it('parses comma-separated chapter ranges', () => {
    expect(parseChapterRange('1-3, 10, 20-22')).toEqual([1, 2, 3, 10, 20, 21, 22]);
    expect(parseChapterRange('3-1')).toEqual([1, 2, 3]);
    expect(parseChapterRange('bad, 5')).toEqual([5]);
  });

  it('selects all, latest N, range, manual ids, and current chapter modes', () => {
    expect(selectChapters(chapters, { mode: 'all' }).map((item) => item.id)).toEqual([1, 2, 3, 10, 11]);
    expect(selectChapters(chapters, { mode: 'latest', count: 2 }).map((item) => item.id)).toEqual([10, 11]);
    expect(selectChapters(chapters, { mode: 'range', range: '2-3,11' }).map((item) => item.id)).toEqual([2, 3, 11]);
    expect(selectChapters(chapters, { mode: 'manual', chapterIds: [11, 1] }).map((item) => item.id)).toEqual([1, 11]);
    expect(selectChapters(chapters, { mode: 'current', currentChapterId: 10 }).map((item) => item.id)).toEqual([10]);
  });
});
