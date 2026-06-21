/**
 * MangaDotNet Nebula — Content Script
 * Self-contained, no imports. Runs on https://mangadot.net/*
 * Handles: ping, get-page-context, fetch-manga, fetch-chapters, fetch-images
 */
(function () {
  'use strict';

  var MANGADOTNET_ORIGIN = 'https://mangadot.net';

  // --- url-detection (inlined) ---
  function isMangaDotNetUrl(rawUrl) {
    if (!rawUrl) return false;
    try {
      var url = new URL(rawUrl);
      return url.protocol === 'https:' && url.hostname === 'mangadot.net';
    } catch (e) {
      return false;
    }
  }

  function detectMangaDotNetPage(rawUrl) {
    var safeUrl = rawUrl || '';
    if (!isMangaDotNetUrl(safeUrl)) {
      return { isSupportedOrigin: false, pageType: 'wrong-origin', mangaId: null, url: safeUrl };
    }
    var url = new URL(safeUrl);
    var pathParts = url.pathname.split('/').filter(Boolean);
    var mangaId = extractMangaId(pathParts);
    if (mangaId === null) {
      return { isSupportedOrigin: true, pageType: 'unsupported', mangaId: null, url: url.href };
    }
    return { isSupportedOrigin: true, pageType: 'manga', mangaId: mangaId, url: url.href };
  }

  function extractMangaId(pathParts) {
    if (pathParts[0] === 'manga' && pathParts[1]) return parsePositiveInt(pathParts[1]);
    if (pathParts[0]) return parsePositiveInt(pathParts[0]);
    return null;
  }

  function parsePositiveInt(value) {
    if (!/^\d+$/.test(value)) return null;
    var parsed = Number(value);
    return Number.isInteger(parsed) && parsed <= Number.MAX_SAFE_INTEGER && parsed > 0 ? parsed : null;
  }

  // --- dom-extractors (inlined) ---
  function extractPageContextFromDocument(doc, url) {
    var detection = detectMangaDotNetPage(url);
    return {
      detection: detection,
      title: extractTitle(doc),
      coverUrl: normalizeUrl(extractCoverUrl(doc))
    };
  }

  function extractTitle(doc) {
    var heading = doc.querySelector('h1');
    var text = heading && heading.textContent ? heading.textContent.trim() : '';
    if (text) return text;
    return doc.title.trim();
  }

  function extractCoverUrl(doc) {
    var meta = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (meta && meta.content) return meta.content;
    var img = doc.querySelector('img[alt*="cover" i], img[src*="cover" i]');
    return img ? img.getAttribute('src') : null;
  }

  function normalizeUrl(value) {
    if (!value) return null;
    try { return new URL(value, MANGADOTNET_ORIGIN).href; }
    catch (e) { return null; }
  }

  // --- API client (inlined) ---
  function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  }

  function apiGetJson(url) {
    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        referer: MANGADOTNET_ORIGIN
      }
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function apiGetManga(mangaId) {
    return apiGetJson(MANGADOTNET_ORIGIN + '/api/manga/' + mangaId + '/').then(function (data) {
      var manga = normalizeMangaInfo(asRecord(data));
      if (manga.coverUrl) {
        return fetchImageAsBase64(manga.coverUrl)
          .then(function (base64) {
            manga.coverUrl = 'data:image/jpeg;base64,' + base64;
            return manga;
          })
          .catch(function () {
            return manga;
          });
      }
      return manga;
    });
  }

  function apiGetChapters(mangaId) {
    return apiGetJson(MANGADOTNET_ORIGIN + '/api/manga/' + mangaId + '/chapters/list').then(function (data) {
      return normalizeChapters(data);
    });
  }

  function apiGetImages(chapterId) {
    return apiGetJson(MANGADOTNET_ORIGIN + '/api/uploads/' + chapterId + '/images').then(function (data) {
      return normalizeChapterImages(asRecord(data));
    });
  }

  // --- Normalizers (inlined from Python port) ---
  function toNullableString(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v;
    return String(v);
  }

  function toNumber(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function toInt(v) {
    var n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  function toStringList(v) {
    if (!Array.isArray(v)) return [];
    return v.map(function (item) {
      if (typeof item === 'string') return item;
      if (item === null || item === undefined) return '';
      return String(item);
    }).filter(Boolean);
  }

  function normalizeMangaInfo(data) {
    var manga = data.manga && typeof data.manga === 'object' ? data.manga : data;
    var rawAuthors = manga.authors;
    var authors = typeof rawAuthors === 'string' ? safeJsonParse(rawAuthors, []) : rawAuthors;
    var rawArtists = manga.artists;
    var artists = typeof rawArtists === 'string' ? safeJsonParse(rawArtists, []) : rawArtists;
    return {
      id: toInt(manga.id),
      title: toNullableString(manga.title),
      slug: toNullableString(manga.slug),
      description: toNullableString(manga.description),
      status: toNullableString(manga.status),
      avgRating: toNumber(manga.avg_rating, null),
      chapterCount: toInt(manga.chapter_count),
      genres: toStringList(manga.genres),
      authors: toStringList(authors),
      artists: toStringList(artists),
      coverUrl: normalizeUrl(manga.photo || manga.cover),
      bannerUrl: normalizeUrl(manga.banner),
      hiatus: toNullableString(manga.hiatus)
    };
  }

  function normalizeChapters(data) {
    if (!Array.isArray(data)) return [];
    return data.map(function (item) {
      var groups = Array.isArray(item.groups) ? item.groups.map(function (g) {
        return { id: toInt(g.id), name: toNullableString(g.name) };
      }) : [];
      return {
        id: toInt(item.id),
        chapterNumber: toNullableString(item.chapter_number),
        volumeNumber: toNullableString(item.volume_number),
        chapterTitle: toNullableString(item.chapter_title),
        language: toNullableString(item.language),
        pageCount: toInt(item.page_count),
        groupId: toInt(item.group_id),
        groupName: toNullableString(item.group_name),
        groups: groups,
        scanlatorName: toNullableString(item.scanlator_name),
        source: toNullableString(item.source) || 'scraper',
        uploaderId: toNullableString(item.uploader_id),
        uploaderUsername: toNullableString(item.uploader_username),
        uploaderUploadStatus: toNullableString(item.uploader_upload_status),
        dateAdded: toNullableString(item.date_added || item.uploaded_at),
        commentCount: toInt(item.comment_count) || 0
      };
    });
  }

  function normalizeChapterImages(data) {
    var images = data.images;
    if (!Array.isArray(images)) return [];
    return images.map(function (item, idx) {
      return {
        index: idx,
        url: normalizeUrl(item.url),
        width: toInt(item.w),
        height: toInt(item.h),
        filename: toNullableString(item.filename)
      };
    });
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  // --- content script message handler ---
  function extractContext() {
    return extractPageContextFromDocument(document, window.location.href);
  }

  function respondWhenReady(sendResponse) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        sendResponse({ ok: true, context: extractContext() });
      }, { once: true });
      return true;
    }
    sendResponse({ ok: true, context: extractContext() });
    return true;
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (message && message.type === 'ping') {
      sendResponse({ ok: true, type: 'pong' });
      return true;
    }

    if (message && message.type === 'get-page-context') {
      return respondWhenReady(sendResponse);
    }

    if (message && message.type === 'fetch-manga') {
      apiGetManga(Number(message.mangaId))
        .then(function (manga) { sendResponse({ ok: true, manga: manga }); })
        .catch(function (err) { sendResponse({ ok: false, error: err && err.message || 'Failed to fetch manga' }); });
      return true;
    }

    if (message && message.type === 'fetch-chapters') {
      apiGetChapters(Number(message.mangaId))
        .then(function (chapters) { sendResponse({ ok: true, chapters: chapters }); })
        .catch(function (err) { sendResponse({ ok: false, error: err && err.message || 'Failed to fetch chapters' }); });
      return true;
    }

    if (message && message.type === 'fetch-images') {
      apiGetImages(Number(message.chapterId))
        .then(function (images) { sendResponse({ ok: true, images: images }); })
        .catch(function (err) { sendResponse({ ok: false, error: err && err.message || 'Failed to fetch images' }); });
      return true;
    }

    if (message && message.type === 'fetch-image-blob') {
      fetchImageAsBase64(String(message.url))
        .then(function (data) { sendResponse({ ok: true, data: data }); })
        .catch(function (err) { sendResponse({ ok: false, error: err && err.message || 'Failed to fetch image' }); });
      return true;
    }

    return false;
  });
})();

function fetchImageAsBase64(url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.withCredentials = true;
    xhr.onload = function () {
      if (xhr.status === 200) {
        var bytes = new Uint8Array(xhr.response);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve(btoa(binary));
      } else {
        reject(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { reject(new Error('XHR error')); };
    xhr.send();
  });
}
