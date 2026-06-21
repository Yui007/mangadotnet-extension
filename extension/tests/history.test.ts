import { describe, expect, it, vi, beforeEach } from 'vitest';
import { addHistoryEntry, getHistory } from '../src/storage/history';
import type { HistoryEntry } from '../src/storage/history';

describe('history persistence', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: store[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          })
        }
      }
    });
  });

  it('starts with empty history', async () => {
    const history = await getHistory();
    expect(history).toHaveLength(0);
  });

  it('adds history entries', async () => {
    const entry: HistoryEntry = {
      mangaId: 166,
      mangaTitle: 'Solo Leveling',
      chapterIds: [1, 2],
      format: 'cbz',
      timestamp: Date.now(),
      pagesDownloaded: 50
    };
    await addHistoryEntry(entry);
    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].mangaTitle).toBe('Solo Leveling');
  });
});
