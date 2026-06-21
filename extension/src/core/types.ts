export const MANGADOTNET_ORIGIN = 'https://mangadot.net';

export type MangaDotNetPageType = 'wrong-origin' | 'unsupported' | 'manga' | 'reader';

export interface PageDetectionResult {
  isSupportedOrigin: boolean;
  pageType: MangaDotNetPageType;
  mangaId: number | null;
  url: string;
}
