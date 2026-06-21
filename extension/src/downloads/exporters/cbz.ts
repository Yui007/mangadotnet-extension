import JSZip from 'jszip';
import { padPageNumber } from '../../core/filename';
import type { ArchiveResult } from './zip';

export async function buildCbzArchive(chapterName: string, images: ArrayBuffer[]): Promise<ArchiveResult> {
  const zip = new JSZip();
  images.forEach((imageData, index) => {
    zip.file(`${padPageNumber(index + 1, images.length)}.jpg`, imageData);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  return { filename: `${chapterName}.cbz`, blob };
}
