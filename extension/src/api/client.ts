import { MANGADOTNET_ORIGIN } from '../core/types';
import { ApiHttpError } from '../core/errors';
import { parseSearchResponse } from './search';
import { normalizeMangaInfo } from './manga';
import { normalizeChapters } from './chapters';
import { normalizeVolumes } from './volumes';
import { normalizeChapterImages } from './images';

export interface MangaDotNetApiClientOptions {
  fetcher?: typeof fetch;
  referer?: string;
}

export class MangaDotNetApiClient {
  private readonly fetcher: typeof fetch;
  private readonly referer: string;

  constructor(options: MangaDotNetApiClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.referer = options.referer ?? MANGADOTNET_ORIGIN;
  }

  async search(query: string, perPage = 50) {
    const url = new URL('/search.data', MANGADOTNET_ORIGIN);
    url.searchParams.set('search', query);
    url.searchParams.set('perPage', String(perPage));
    return parseSearchResponse(await this.getJson(url.href));
  }

  async getManga(mangaId: number) {
    return normalizeMangaInfo(asRecord(await this.getJson(`${MANGADOTNET_ORIGIN}/api/manga/${mangaId}/`)));
  }

  async getChapters(mangaId: number) {
    return normalizeChapters(await this.getJson(`${MANGADOTNET_ORIGIN}/api/manga/${mangaId}/chapters/list`));
  }

  async getVolumes(mangaId: number) {
    return normalizeVolumes(await this.getJson(`${MANGADOTNET_ORIGIN}/api/manga/${mangaId}/volumes`));
  }

  async getImages(chapterOrVolumeId: number) {
    return normalizeChapterImages(asRecord(await this.getJson(`${MANGADOTNET_ORIGIN}/api/uploads/${chapterOrVolumeId}/images`)));
  }

  private async getJson(url: string): Promise<Record<string, unknown> | unknown[]> {
    const response = await this.fetcher(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        referer: this.referer
      }
    });

    if (!response.ok) throw new ApiHttpError(url, response.status);
    return response.json() as Promise<Record<string, unknown> | unknown[]>;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
