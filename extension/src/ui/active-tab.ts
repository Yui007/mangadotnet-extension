import { detectMangaDotNetPage } from '../core/url-detection';

export interface ActiveTabLike {
  id?: number;
  url?: string;
}

export interface ActiveTabDependencies {
  queryActiveTab: () => Promise<ActiveTabLike | undefined>;
  sendTabMessage: (tabId: number, message: unknown) => Promise<unknown>;
  reloadTab: (tabId: number) => Promise<void>;
  delay: (ms: number) => Promise<void>;
}

export interface ActiveTabOptions {
  retries?: number;
  retryDelayMs?: number;
  reloadOnFailure?: boolean;
}

export type ActiveTabContextResult =
  | { state: 'wrong-origin'; reason: string }
  | { state: 'no-tab'; reason: string }
  | { state: 'unsupported'; reason: string }
  | { state: 'ready'; context: unknown }
  | { state: 'content-unavailable'; reason: string };

export async function getPageContextWithRetries(
  deps: ActiveTabDependencies,
  options: ActiveTabOptions = {}
): Promise<ActiveTabContextResult> {
  const retries = options.retries ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 300;
  const tab = await deps.queryActiveTab();

  if (!tab?.id) return { state: 'no-tab', reason: 'No active browser tab was found.' };

  const detection = detectMangaDotNetPage(tab.url);
  if (!detection.isSupportedOrigin) {
    return { state: 'wrong-origin', reason: 'Open MangaDotNet to start.' };
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await deps.sendTabMessage(tab.id, { type: 'get-page-context' });
      return { state: 'ready', context: response };
    } catch {
      if (attempt === retries) break;
      await deps.delay(retryDelayMs);
    }
  }

  if (options.reloadOnFailure) {
    await deps.reloadTab(tab.id);
  }

  return {
    state: detection.mangaId ? 'content-unavailable' : 'unsupported',
    reason: detection.mangaId
      ? 'Content script is not ready yet. Try refreshing the MangaDotNet page.'
      : 'No manga ID detected in the URL. Open a manga details or chapter page.'
  };
}

export const chromeActiveTabDependencies: ActiveTabDependencies = {
  queryActiveTab: async () => {
    // Query all tabs across all windows to find a MangaDotNet tab
    const allTabs = await chrome.tabs.query({ url: 'https://mangadot.net/*' });
    if (allTabs.length > 0 && allTabs[0].id) return allTabs[0];
    // Fallback: any tab in current window
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    return active;
  },
  sendTabMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  reloadTab: (tabId) => chrome.tabs.reload(tabId),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
};
