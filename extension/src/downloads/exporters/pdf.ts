import { PDFDocument } from 'pdf-lib';

async function ensurePngOrJpg(imgBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(imgBuffer);
  if (
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
  ) {
    return imgBuffer; // Already valid JPEG or PNG
  }

  // Fallback if running in node test environment
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return imgBuffer;
  }

  try {
    const blob = new Blob([imgBuffer]);
    const imageBitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get OffscreenCanvas 2D context');
    ctx.drawImage(imageBitmap, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    return await pngBlob.arrayBuffer();
  } catch (err) {
    console.error('Failed to convert image to PNG:', err);
    return imgBuffer;
  }
}

export async function buildPdfArchive(
  chapterName: string,
  images: ArrayBuffer[]
): Promise<{ blob: Blob }> {
  const pdfDoc = await PDFDocument.create();

  for (const rawBuffer of images) {
    const imgBuffer = await ensurePngOrJpg(rawBuffer);
    try {
      // Try embedding as JPEG first
      const image = await pdfDoc.embedJpg(imgBuffer);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } catch (e) {
      // If it fails (e.g. it is a PNG), try embedding as PNG
      try {
        const image = await pdfDoc.embedPng(imgBuffer);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      } catch (err) {
        console.error('Failed to embed image in PDF:', err);
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  };
}
