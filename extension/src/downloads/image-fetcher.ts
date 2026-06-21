import { MANGADOTNET_ORIGIN } from '../core/types';

export interface XhrDeps {
  create?: () => XMLHttpRequest;
}

export function fetchImageBytes(
  url: string,
  referer: string = MANGADOTNET_ORIGIN,
  deps: XhrDeps = {}
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = deps.create ? deps.create() : new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error(`HTTP ${xhr.status} for ${url}`));
      }
    };
    xhr.onerror = () => reject(new Error(`XHR network error for ${url}`));
    xhr.send();
  });
}
