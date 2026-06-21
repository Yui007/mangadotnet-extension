import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadSettings, saveSettings } from '../src/storage/settings';
import { DEFAULT_SETTINGS } from '../src/storage/settings';

describe('settings persistence', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string | string[]) => {
            if (Array.isArray(key)) {
              return Object.fromEntries(key.map((k) => [k, store[k]]));
            }
            return { [key]: store[key] };
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          })
        }
      }
    });
  });

  it('loads default settings when storage is empty', async () => {
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads settings', async () => {
    const custom = { ...DEFAULT_SETTINGS, defaultFormat: 'pdf' as const };
    await saveSettings(custom);
    const loaded = await loadSettings();
    expect(loaded.defaultFormat).toBe('pdf');
  });
});
