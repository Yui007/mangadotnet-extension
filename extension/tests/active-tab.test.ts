import { describe, expect, it } from 'vitest';
import { getPageContextWithRetries } from '../src/ui/active-tab';

describe('active tab context', () => {
  it('returns wrong-origin without messaging the content script', async () => {
    let messages = 0;
    const result = await getPageContextWithRetries({
      queryActiveTab: async () => ({ id: 1, url: 'https://example.com/' }),
      sendTabMessage: async () => {
        messages += 1;
        return { ok: true };
      },
      reloadTab: async () => undefined,
      delay: async () => undefined
    });

    expect(result.state).toBe('wrong-origin');
    expect(messages).toBe(0);
  });

  it('retries content script context requests before succeeding', async () => {
    let attempts = 0;
    const result = await getPageContextWithRetries({
      queryActiveTab: async () => ({ id: 7, url: 'https://mangadot.net/manga/166' }),
      sendTabMessage: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('Receiving end does not exist');
        return { ok: true, context: { detection: { mangaId: 166 } } };
      },
      reloadTab: async () => undefined,
      delay: async () => undefined
    }, { retries: 3 });

    expect(result.state).toBe('ready');
    expect(attempts).toBe(3);
  });
});
