import { padPageNumber } from '../../core/filename';

export interface ImageFileEntry {
  filename: string;
  data: ArrayBuffer;
}

export interface ImagesExportResult {
  folderName: string;
  files: ImageFileEntry[];
}

export async function buildImagesExport(chapterName: string, images: ArrayBuffer[]): Promise<ImagesExportResult> {
  return {
    folderName: chapterName,
    files: images.map((imageData, index) => ({
      filename: `${padPageNumber(index + 1, images.length)}.jpg`,
      data: imageData
    }))
  };
}
