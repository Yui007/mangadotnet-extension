import { describe, expect, it } from 'vitest';
import { normalizeMangaInfo } from '../src/api/manga';
import { normalizeChapters } from '../src/api/chapters';
import { normalizeChapterImages } from '../src/api/images';

describe('MangaDotNet API normalizers', () => {
  it('normalizes manga info wrapper quirks', () => {
    const manga = normalizeMangaInfo({
      manga: {
        id: 166,
        title: 'Solo Leveling',
        genres: ['Action'],
        status: 'Completed',
        description: 'Demo',
        authors: '["Chugong"]',
        artists: '["DUBU"]',
        chapter_count: 200,
        rating: '81.7',
        avg_rating: '9.1',
        rating_count: 123,
        alt_titles: ['Na Honjaman Level Up'],
        is_adult: false,
        country_of_origin: 'KR',
        year: '2018',
        photo: '/covers/solo.jpg',
        banner_image: '/banners/solo.jpg',
        hiatus: 'No',
        is_blurworthy: 0
      },
      total_chapters: 201,
      first_chapter_id: 10,
      first_chapter_source: 'user',
      status_text: 'Completed',
      date_added_formatted: 'Jan 1, 2024'
    });

    expect(manga.authors).toEqual(['Chugong']);
    expect(manga.artists).toEqual(['DUBU']);
    expect(manga.rating).toBe(81.7);
    expect(manga.avgRating).toBe(9.1);
    expect(manga.year).toBe(2018);
    expect(manga.hiatus).toBe('No');
    expect(manga.coverUrl).toBe('https://mangadot.net/covers/solo.jpg');
    expect(manga.bannerUrl).toBe('https://mangadot.net/banners/solo.jpg');
    expect(manga.totalChapters).toBe(201);
  });

  it('normalizes chapters without deduplicating duplicate variants', () => {
    const chapters = normalizeChapters([
      { id: 1, chapter_number: '1', volume_number: '1', chapter_title: 'Start', language: 'en', page_count: 10, group_id: 5, group_name: 'A', groups: [{ id: 5, name: 'A' }], source: 'scraper' },
      { id: 2, chapter_number: 1, language: 'en', page_count: 12, group_id: 6, group_name: 'B', source: 'user' }
    ]);

    expect(chapters).toHaveLength(2);
    expect(chapters.map((chapter) => chapter.id)).toEqual([1, 2]);
    expect(chapters[0].chapterNumber).toBe('1');
    expect(chapters[0].volumeNumber).toBe('1');
    expect(chapters[0].groups).toEqual([{ id: 5, name: 'A' }]);
  });

  it('normalizes ordered image metadata and relative URLs', () => {
    const images = normalizeChapterImages({
      chapter: { id: 1 },
      manga: { id: 166 },
      images: [
        { url: '/chapters/1/002.webp', w: 700, h: 1000, filename: '002.webp' },
        { url: 'https://mangadot.net/chapters/1/001.jpg', width: 700, height: 1000, filename: '001.jpg' }
      ],
      prev_chapter_id: null,
      next_chapter_id: 2,
      type: 'chapter',
      volume_number: null,
      source: 'user'
    });

    expect(images.images.map((image) => image.filename)).toEqual(['002.webp', '001.jpg']);
    expect(images.images[0].url).toBe('https://mangadot.net/chapters/1/002.webp');
    expect(images.nextChapterId).toBe(2);
  });
});
