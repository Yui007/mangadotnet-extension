export type ExportFormat = 'cbz' | 'zip' | 'pdf' | 'images' | 'folder';
export type ImageQuality = 'low' | 'medium' | 'high' | 'original';
export type ThemeName = 'nebula-dark' | 'midnight' | 'system';

export interface ExtensionSettings {
  defaultFormat: ExportFormat;
  defaultLanguage: string;
  defaultScanlatorGroup: string | null;
  preferUserUploaded: boolean;
  checkUpdates: boolean;
  download: {
    maxConcurrentDownloads: number;
    maxConcurrentChapters: number;
    maxConcurrentImages: number;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
  };
  quality: {
    default: ImageQuality;
    convertWebp: boolean;
    jpegQuality: number;
  };
  cache: {
    enabled: boolean;
    maxSizeMb: number;
    ttlHours: number;
  };
  ui: {
    theme: ThemeName;
    showThumbnails: boolean;
    compactMode: boolean;
  };
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultFormat: 'cbz',
  defaultLanguage: 'en',
  defaultScanlatorGroup: null,
  preferUserUploaded: true,
  checkUpdates: true,
  download: {
    maxConcurrentDownloads: 3,
    maxConcurrentChapters: 4,
    maxConcurrentImages: 8,
    maxRetries: 3,
    retryDelay: 2,
    timeout: 30
  },
  quality: {
    default: 'original',
    convertWebp: true,
    jpegQuality: 95
  },
  cache: {
    enabled: true,
    maxSizeMb: 50,
    ttlHours: 24
  },
  ui: {
    theme: 'nebula-dark',
    showThumbnails: true,
    compactMode: false
  }
};

const SETTINGS_KEY = 'mangadotnet-settings';

export async function loadSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    if (result[SETTINGS_KEY]) {
      return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
