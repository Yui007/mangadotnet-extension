import type { MangaInfo } from '../core/models';
import { normalizeUrl, toInt, toNullableString, toNumber, toStringList } from '../core/models';

export function normalizeMangaInfo(data: Record<string, unknown>): MangaInfo {
  const manga = isRecord(data.manga) ? data.manga : data;
  const photo = String(manga.photo ?? '');
  const bannerImage = toNullableString(manga.banner_image);

  return {
    id: toInt(manga.id),
    title: String(manga.title ?? ''),
    genres: Array.isArray(manga.genres) ? manga.genres.map(String) : [],
    status: String(manga.status ?? ''),
    description: String(manga.description ?? ''),
    authors: toStringList(manga.authors),
    artists: toStringList(manga.artists),
    chapterCount: toInt(manga.chapter_count),
    rating: toNumber(manga.rating),
    avgRating: toNumber(manga.avg_rating),
    ratingCount: toInt(manga.rating_count),
    altTitles: Array.isArray(manga.alt_titles) ? manga.alt_titles.map(String) : [],
    isAdult: Boolean(manga.is_adult),
    countryOfOrigin: String(manga.country_of_origin ?? ''),
    year: toNumber(manga.year),
    photo,
    bannerImage,
    dateAdded: String(manga.date_added ?? ''),
    hiatus: String(manga.hiatus ?? 'No'),
    sourceUrl: toNullableString(manga.source_url),
    scanlationGroup: toNullableString(manga.scanlation_group),
    isBlurworthy: Boolean(manga.is_blurworthy),
    contentRating: String(manga.content_rating ?? 'safe'),
    isHot: Boolean(manga.is_hot),
    isPopular: Boolean(manga.is_popular),
    viewCount: toInt(manga.view_count),
    commentCount: toInt(manga.comment_count),
    trackedCount: toInt(manga.tracked_count),
    lastChapterDate: toNullableString(manga.last_chapter_date),
    updateDay: toNullableString(manga.update_day),
    reviewCount: toInt(manga.review_count),
    mangaupdatesId: toNullableString(manga.mangaupdates_id),
    anilistId: toNumber(manga.anilist_id),
    mangadexId: toNullableString(manga.mangadex_id),
    malId: toNumber(manga.mal_id),
    kitsuId: toNumber(manga.kitsu_id),
    mangabakaId: toNumber(manga.mangabaka_id),
    totalChapters: toInt(data.total_chapters),
    firstChapterId: toNumber(data.first_chapter_id),
    firstChapterSource: toNullableString(data.first_chapter_source),
    statusText: String(data.status_text ?? ''),
    dateAddedFormatted: String(data.date_added_formatted ?? ''),
    coverUrl: normalizeUrl(photo),
    bannerUrl: bannerImage ? normalizeUrl(bannerImage) : null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
