import JSZip from 'jszip';
import { padPageNumber } from '../../core/filename';

export interface ArchiveResult {
  filename: string;
  blob: Blob;
}

export async function buildZipArchive(chapterName: string, images: ArrayBuffer[]): Promise<ArchiveResult> {
  const zip = new JSZip();
  images.forEach((imageData, index) => {
    zip.file(`${padPageNumber(index + 1, images.length)}.jpg`, imageData);
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { filename: `${chapterName}.zip`, blob };
}
