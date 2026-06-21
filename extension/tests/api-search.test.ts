import { describe, expect, it } from 'vitest';
import { parseSearchResponse } from '../src/api/search';

describe('MangaDotNet packed search parser', () => {
  it('resolves Nuxt-style packed array search results', () => {
    const packed = [
      'results', [20, 21],
      'id', 'title', 'photo', 'status', 'avg_rating', 'chapter_count', 'genres', 'description', 'is_blurworthy',
      null, null, null, null, null, null, null, null, null,
      { _2: 22, _3: 23, _4: 24, _5: 25, _6: 26, _7: 27, _8: 28, _9: 29, _10: 30 },
      { _2: 31, _3: 32, _4: 33, _5: 34, _6: 35, _7: 36, _8: 37, _9: 38, _10: 39 },
      166, 'Solo Leveling', '/covers/solo.jpg', 'Completed', '9.2', 200, ['Action', 'Fantasy'], 'Hunter story', 0,
      42, 'Second Manga', '/covers/two.webp', 'Ongoing', 7.5, 12, ['Drama'], '', true
    ];

    const results = parseSearchResponse(packed);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: 166,
      title: 'Solo Leveling',
      photo: '/covers/solo.jpg',
      coverUrl: 'https://mangadot.net/covers/solo.jpg',
      status: 'Completed',
      rating: 9.2,
      chapterCount: 200,
      genres: ['Action', 'Fantasy'],
      description: 'Hunter story',
      isAdult: false
    });
    expect(results[1].isAdult).toBe(true);
  });

  it('returns an empty list for malformed packed data', () => {
    expect(parseSearchResponse({ nope: true })).toEqual([]);
    expect(parseSearchResponse(['not-results', []])).toEqual([]);
  });
});
