import type { Volume } from '../core/models';
import { normalizeUrl, toInt, toNullableString } from '../core/models';

export function normalizeVolumes(data: unknown): Volume[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord).map((volume) => ({
    id: toInt(volume.id),
    volumeNumber: toInt(volume.volume_number),
    pageCount: toInt(volume.page_count),
    coverUrl: normalizeUrl(volume.cover_url),
    groupName: toNullableString(volume.group_name),
    uploaderUsername: toNullableString(volume.uploader_username),
    groups: Array.isArray(volume.groups) ? volume.groups.filter(isRecord) : []
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
