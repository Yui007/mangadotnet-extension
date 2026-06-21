import { describe, expect, it, vi } from 'vitest';
import { MangaDotNetApiClient } from '../src/api/client';

describe('MangaDotNetApiClient', () => {
  it('uses exact MangaDotNet endpoints and credentialed JSON request headers', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(input), init]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const client = new MangaDotNetApiClient({ fetcher, referer: 'https://mangadot.net/manga/166' });

    await client.search('solo level', 25);
    await client.getManga(166);
    await client.getChapters(166);
    await client.getVolumes(166);
    await client.getImages(77);

    expect(calls.map((call) => call[0])).toEqual([
      'https://mangadot.net/search.data?search=solo+level&perPage=25',
      'https://mangadot.net/api/manga/166/',
      'https://mangadot.net/api/manga/166/chapters/list',
      'https://mangadot.net/api/manga/166/volumes',
      'https://mangadot.net/api/uploads/77/images'
    ]);
    expect(calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include'
    });
    expect((calls[0][1]?.headers as Record<string, string>)['x-requested-with']).toBe('XMLHttpRequest');
  });

  it('throws a typed API error for non-OK responses', async () => {
    const client = new MangaDotNetApiClient({ fetcher: async () => new Response('blocked', { status: 403 }) });
    await expect(client.getManga(166)).rejects.toMatchObject({ name: 'ApiHttpError', status: 403, retryable: true });
  });
});
