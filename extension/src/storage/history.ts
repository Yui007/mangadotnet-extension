import type { ExportFormat } from './settings';

export interface HistoryEntry {
  mangaId: number;
  mangaTitle: string;
  chapterIds: number[];
  format: ExportFormat;
  timestamp: number;
  pagesDownloaded: number;
  status?: string;
  error?: string;
}

const HISTORY_KEY = 'mangadotnet-history';

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const result = await chrome.storage.local.get(HISTORY_KEY);
    return result[HISTORY_KEY] ?? [];
  } catch {
    return [];
  }
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > 100) history.length = 100;
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}
