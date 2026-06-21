import { describe, expect, it, vi } from 'vitest';
import { fetchImageBytes } from '../src/downloads/image-fetcher';

describe('Image fetcher', () => {
  it('uses XHR with credentials for image downloads', async () => {
    const mockResponse = new Uint8Array([72, 69, 76, 76, 79]).buffer;
    const fakeXhr = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      responseType: '',
      withCredentials: false,
      status: 0,
      response: null as ArrayBuffer | null,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => fakeXhr));

    const promise = fetchImageBytes('https://mangadot.net/chapters/1/page.jpg', 'https://mangadot.net/manga/166');
    fakeXhr.response = mockResponse;
    fakeXhr.status = 200;
    fakeXhr.onload?.();

    const result = await promise;
    expect(fakeXhr.withCredentials).toBe(true);
    expect(fakeXhr.responseType).toBe('arraybuffer');
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(5);

    vi.restoreAllMocks();
  });
});
