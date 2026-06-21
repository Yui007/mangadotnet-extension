import { describe, expect, it } from 'vitest';
import { parseSearchResponse } from '../src/api/search';
import { normalizeMangaInfo } from '../src/api/manga';
import { normalizeChapters } from '../src/api/chapters';
import { normalizeChapterImages } from '../src/api/images';
import { filterAndDeduplicateChapters, getAvailableGroups, getAvailableLanguages } from '../src/core/chapter-filter';

function loadSearchFixture(): unknown[] {
  return [
    'results', [20, 21],
    'id', 'title', 'photo', 'status', 'avg_rating', 'chapter_count', 'genres', 'description', 'is_blurworthy',
    null, null, null, null, null, null, null, null, null,
    { '_2': 22, '_3': 23, '_4': 24, '_5': 25, '_6': 26, '_7': 27, '_8': 28, '_9': 29, '_10': 30 },
    { '_2': 31, '_3': 32, '_4': 33, '_5': 34, '_6': 35, '_7': 36, '_8': 37, '_9': 38, '_10': 39 },
    166, 'Solo Leveling', '/covers/solo.jpg', 'Completed', '9.2', 200, ['Action', 'Fantasy'], 'A hunter must fight monsters.', 0,
    42, 'Tower of God', '/covers/tog.webp', 'Ongoing', '7.5', 12, ['Drama', 'Action'], 'Climb the tower', 1
  ];
}

function loadMangaInfoFixture(): Record<string, unknown> {
  return {
    manga: {
      id: 166, title: 'Solo Leveling', genres: ['Action', 'Fantasy'], status: 'Completed',
      description: 'A hunter must fight monsters.', authors: '["Chugong"]', artists: '["DUBU"]',
      chapter_count: 200, rating: '81.7', avg_rating: '9.1', rating_count: 1234,
      alt_titles: ['Na Honjaman Level Up'], is_adult: false, country_of_origin: 'KR', year: '2018',
      photo: '/covers/solo.jpg', banner_image: '/banners/solo.jpg', date_added: '2018-02-01',
      hiatus: 'No', is_blurworthy: 0, content_rating: 'safe', is_hot: true, is_popular: true
    },
    total_chapters: 201, first_chapter_id: 1001, first_chapter_source: 'user',
    status_text: 'Completed', date_added_formatted: 'Feb 1, 2018'
  };
}

function loadChaptersFixture(): unknown[] {
  return [
    { id: 1, chapter_number: 1, volume_number: 1, chapter_title: 'Chapter 1', language: 'en', page_count: 45, group_id: 10, group_name: 'Alpha Group', groups: [{ id: 10, name: 'Alpha Group' }], source: 'user', date_added: '2024-01-10' },
    { id: 2, chapter_number: 1, volume_number: 1, chapter_title: 'Chapter 1', language: 'en', page_count: 40, group_id: 20, group_name: 'Beta Group', groups: [{ id: 20, name: 'Beta Group' }], source: 'scraper', date_added: '2024-01-05' },
    { id: 3, chapter_number: 1, volume_number: 1, chapter_title: 'Capítulo 1', language: 'es', page_count: 42, group_id: 30, group_name: 'Spanish Team', groups: [{ id: 30, name: 'Spanish Team' }], source: 'user', date_added: '2024-01-08' },
    { id: 4, chapter_number: 2, volume_number: 1, chapter_title: 'Chapter 2', language: 'en', page_count: 38, group_id: 10, group_name: 'Alpha Group', groups: [{ id: 10, name: 'Alpha Group' }], source: 'user', date_added: '2024-01-15' },
    { id: 5, chapter_number: 3, volume_number: null, chapter_title: 'Chapter 3', language: 'en', page_count: 41, group_id: 10, group_name: 'Alpha Group', groups: [{ id: 10, name: 'Alpha Group' }], source: 'user', date_added: '2024-01-20' }
  ];
}

function loadImagesFixture(): Record<string, unknown> {
  return {
    chapter: { id: 1 }, manga: { id: 166 },
    images: [
      { url: '/chapters/1/page001.webp', w: 700, h: 1000, filename: 'page001.webp' },
      { url: '/chapters/1/page002.webp', w: 700, h: 1000, filename: 'page002.webp' },
      { url: 'https://mangadot.net/chapters/1/page003.jpg', w: 800, h: 1200, filename: 'page003.jpg' }
    ],
    prev_chapter_id: null, next_chapter_id: 2, type: 'chapter', volume_number: null, source: 'user'
  };
}

describe('fixture-based parser tests', () => {
  it('parses search fixture into MangaResult array', () => {
    const results = parseSearchResponse(loadSearchFixture());
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe('Solo Leveling');
  });

  it('normalizes manga info fixture handling string quirks', () => {
    const manga = normalizeMangaInfo(loadMangaInfoFixture());
    expect(manga.authors).toEqual(['Chugong']);
    expect(manga.rating).toBe(81.7);
    expect(manga.avgRating).toBe(9.1);
    expect(manga.year).toBe(2018);
    expect(manga.hiatus).toBe('No');
    expect(manga.coverUrl).toBe('https://mangadot.net/covers/solo.jpg');
  });

  it('normalizes chapter fixture preserving duplicates', () => {
    const chapters = normalizeChapters(loadChaptersFixture());
    expect(chapters.length).toBe(5);
    expect(chapters.filter((ch) => ch.chapterNumber === '1').length).toBe(3);
  });

  it('filters and deduplicates chapter fixture to best variants', () => {
    const chapters = normalizeChapters(loadChaptersFixture());
    const result = filterAndDeduplicateChapters(chapters, { language: 'en', preferUserUploaded: true });
    expect(result.length).toBe(3);
    expect(result.map((ch) => ch.id)).toEqual([1, 4, 5]);
  });

  it('reports available languages and groups from chapter fixture', () => {
    const chapters = normalizeChapters(loadChaptersFixture());
    const langs = getAvailableLanguages(chapters);
    expect(langs.some((l) => l.code === 'en')).toBe(true);
    expect(langs.some((l) => l.code === 'es')).toBe(true);
    const groups = getAvailableGroups(chapters, 'en');
    expect(groups.length).toBeGreaterThan(0);
  });

  it('normalizes chapter images fixture with relative URLs', () => {
    const images = normalizeChapterImages(loadImagesFixture());
    expect(images.images).toHaveLength(3);
    expect(images.images[0].url).toBe('https://mangadot.net/chapters/1/page001.webp');
    expect(images.images[2].url).toBe('https://mangadot.net/chapters/1/page003.jpg');
  });
});
