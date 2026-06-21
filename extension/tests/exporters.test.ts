import { describe, expect, it } from 'vitest';
import { buildZipArchive } from '../src/downloads/exporters/zip';
import { buildCbzArchive } from '../src/downloads/exporters/cbz';
import { buildImagesExport } from '../src/downloads/exporters/images';
import { buildPdfArchive } from '../src/downloads/exporters/pdf';

describe('export format builders', () => {
  const sampleImages: ArrayBuffer[] = [
    new Uint8Array([72, 69, 76, 76, 79]).buffer,
    new Uint8Array([87, 79, 82, 76, 68]).buffer
  ];

  it('builds a ZIP archive with numbered pages', async () => {
    const zip = await buildZipArchive('test_chapter', sampleImages);
    expect(zip.filename).toBe('test_chapter.zip');
    expect(zip.blob.type).toBe('application/zip');
    expect(zip.blob.size).toBeGreaterThan(0);
  });

  it('builds a CBZ archive with .cbz extension', async () => {
    const cbz = await buildCbzArchive('test_chapter', sampleImages);
    expect(cbz.filename).toBe('test_chapter.cbz');
  });

  it('builds images export as individual file entries', async () => {
    const result = await buildImagesExport('test_chapter', sampleImages);
    expect(result.folderName).toBe('test_chapter');
    expect(result.files).toHaveLength(2);
    expect(result.files[0].filename).toBe('0001.jpg');
    expect(result.files[1].filename).toBe('0002.jpg');
  });

  it('builds a PDF file with embedded pages', async () => {
    const oneByOnePng = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]).buffer;
    const pdf = await buildPdfArchive('test_chapter', [oneByOnePng]);
    expect(pdf.blob.type).toBe('application/pdf');
    expect(pdf.blob.size).toBeGreaterThan(0);
  });
});
