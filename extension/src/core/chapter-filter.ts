import type { Chapter } from './models';

export interface ChapterFilterOptions {
  language?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  preferUserUploaded?: boolean;
}

export interface GroupSummary {
  id: number;
  name: string;
  chapterCount: number;
}

export interface LanguageSummary {
  code: string;
  count: number;
}

export function filterAndDeduplicateChapters(
  chapters: Chapter[],
  options: ChapterFilterOptions = {}
): Chapter[] {
  const preferUserUploaded = options.preferUserUploaded ?? true;
  let filtered = [...chapters];

  if (options.language) {
    filtered = filtered.filter((chapter) => chapter.language === options.language);
  }

  if (options.groupId) {
    filtered = filtered.filter((chapter) => chapter.groupId === options.groupId);
  } else if (options.groupName) {
    const groupName = options.groupName.toLowerCase();
    filtered = filtered.filter((chapter) => chapter.groupName?.toLowerCase().includes(groupName));
  }

  const byNumber = new Map<string, Chapter[]>();
  for (const chapter of filtered) {
    const variants = byNumber.get(chapter.chapterNumber) ?? [];
    variants.push(chapter);
    byNumber.set(chapter.chapterNumber, variants);
  }

  return Array.from(byNumber.values())
    .map((variants) => pickBestVariant(variants, preferUserUploaded))
    .sort(compareChapterSortKey);
}

export function pickBestVariant(variants: Chapter[], preferUserUploaded = true): Chapter {
  if (variants.length === 0) throw new Error('Cannot pick a chapter variant from an empty list.');
  return [...variants].sort((a, b) => compareVariantPriority(b, a, preferUserUploaded))[0];
}

export function getAvailableGroups(chapters: Chapter[], language?: string | null): GroupSummary[] {
  const filtered = language ? chapters.filter((chapter) => chapter.language === language) : chapters;
  const groups = new Map<number, GroupSummary>();

  for (const chapter of filtered) {
    if (!chapter.groupId || !chapter.groupName) continue;
    const current = groups.get(chapter.groupId) ?? { id: chapter.groupId, name: chapter.groupName, chapterCount: 0 };
    current.chapterCount += 1;
    groups.set(chapter.groupId, current);
  }

  return Array.from(groups.values()).sort((a, b) => b.chapterCount - a.chapterCount);
}

export function getAvailableLanguages(chapters: Chapter[]): LanguageSummary[] {
  const languages = new Map<string, number>();
  for (const chapter of chapters) {
    languages.set(chapter.language, (languages.get(chapter.language) ?? 0) + 1);
  }
  return Array.from(languages.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
}

export function compareChapterSortKey(a: Chapter, b: Chapter): number {
  const volumeA = a.volumeNumber ? Number(a.volumeNumber) : Number.POSITIVE_INFINITY;
  const volumeB = b.volumeNumber ? Number(b.volumeNumber) : Number.POSITIVE_INFINITY;
  if (volumeA !== volumeB) return volumeA - volumeB;
  const chA = Number(a.chapterNumber);
  const chB = Number(b.chapterNumber);
  return (Number.isFinite(chA) ? chA : Number.POSITIVE_INFINITY) - (Number.isFinite(chB) ? chB : Number.POSITIVE_INFINITY);
}

function compareVariantPriority(a: Chapter, b: Chapter, preferUserUploaded: boolean): number {
  const prioritiesA = variantPriority(a, preferUserUploaded);
  const prioritiesB = variantPriority(b, preferUserUploaded);
  for (let index = 0; index < prioritiesA.length; index += 1) {
    if (prioritiesA[index] !== prioritiesB[index]) return prioritiesA[index] > prioritiesB[index] ? 1 : -1;
  }
  return 0;
}

function variantPriority(chapter: Chapter, preferUserUploaded: boolean): [number, number, number, string] {
  return [
    preferUserUploaded && chapter.source === 'user' ? 1 : 0,
    chapter.groupName ? 1 : 0,
    chapter.pageCount,
    chapter.dateAdded ?? ''
  ];
}
