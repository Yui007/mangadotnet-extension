import { extractPageContextFromDocument } from './dom-extractors';
import { MangaDotNetApiClient } from '../api/client';

type RuntimeMessage = { type?: string; mangaId?: number; [key: string]: unknown };

const client = new MangaDotNetApiClient();

function extractContext() {
  return extractPageContextFromDocument(document, window.location.href);
}

function respondWhenReady(sendResponse: (response?: unknown) => void) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => sendResponse({ ok: true, context: extractContext() }), { once: true });
    return true;
  }

  sendResponse({ ok: true, context: extractContext() });
  return true;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'ping') {
    sendResponse({ ok: true, type: 'pong' });
    return true;
  }

  if (message?.type === 'get-page-context') {
    return respondWhenReady(sendResponse);
  }

  if (message?.type === 'fetch-manga') {
    client.getManga(Number(message.mangaId))
      .then((manga) => sendResponse({ ok: true, manga }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Failed to fetch manga' }));
    return true;
  }

  if (message?.type === 'fetch-chapters') {
    client.getChapters(Number(message.mangaId))
      .then((chapters) => sendResponse({ ok: true, chapters }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Failed to fetch chapters' }));
    return true;
  }

  if (message?.type === 'fetch-images') {
    client.getImages(Number(message.chapterId))
      .then((images) => sendResponse({ ok: true, images }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Failed to fetch images' }));
    return true;
  }

  return false;
});
