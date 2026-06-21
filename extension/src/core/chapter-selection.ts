import type { Chapter } from './models';
import { compareChapterSortKey } from './chapter-filter';

export type ChapterSelectionMode = 'all' | 'latest' | 'range' | 'manual' | 'current';

export type ChapterSelectionOptions =
  | { mode: 'all' }
  | { mode: 'latest'; count?: number }
  | { mode: 'range'; range?: string }
  | { mode: 'manual'; chapterIds?: number[] }
  | { mode: 'current'; currentChapterId?: number | null };

export function parseChapterRange(input: string): number[] {
  const selected = new Set<number>();
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const low = Math.min(start, end);
      const high = Math.max(start, end);
      for (let current = Math.ceil(low); current <= Math.floor(high); current += 1) {
        selected.add(current);
      }
      continue;
    }

    const single = Number(part);
    if (Number.isFinite(single)) selected.add(single);
  }
  return Array.from(selected).sort((a, b) => a - b);
}

export function selectChapters(chapters: Chapter[], options: ChapterSelectionOptions): Chapter[] {
  const sorted = [...chapters].sort(compareChapterSortKey);

  switch (options.mode) {
    case 'all':
      return sorted;
    case 'latest':
      return sorted.slice(-Math.max(0, options.count ?? 1));
    case 'range': {
      const wanted = new Set(parseChapterRange(options.range ?? ''));
      return sorted.filter((chapter) => wanted.has(Number(chapter.chapterNumber)));
    }
    case 'manual': {
      const wanted = new Set(options.chapterIds ?? []);
      return sorted.filter((chapter) => wanted.has(chapter.id));
    }
    case 'current':
      return sorted.filter((chapter) => chapter.id === options.currentChapterId);
  }
}
