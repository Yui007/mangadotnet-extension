import type { Chapter, ScanlatorGroup } from '../core/models';
import { toInt, toNullableString, toNumber } from '../core/models';

export function normalizeChapters(data: unknown): Chapter[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord).map(normalizeChapter);
}

function normalizeChapter(data: Record<string, unknown>): Chapter {
  return {
    id: toInt(data.id),
    chapterNumber: toNullableString(data.chapter_number) ?? '0',
    volumeNumber: toNullableString(data.volume_number),
    chapterTitle: toNullableString(data.chapter_title),
    language: String(data.language ?? 'en'),
    pageCount: toInt(data.page_count),
    groupId: toInt(data.group_id),
    groupName: toNullableString(data.group_name),
    groups: normalizeGroups(data.groups),
    scanlatorName: toNullableString(data.scanlator_name),
    source: String(data.source ?? ''),
    uploaderId: toNullableString(data.uploader_id),
    uploaderUsername: toNullableString(data.uploader_username),
    uploaderUploadStatus: toNullableString(data.uploader_upload_status),
    dateAdded: toNullableString(data.date_added),
    commentCount: toInt(data.comment_count)
  };
}

function normalizeGroups(value: unknown): ScanlatorGroup[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((group) => ({ id: toInt(group.id), name: String(group.name ?? '') }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
