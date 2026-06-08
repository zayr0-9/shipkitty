export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
};

const MAX_SIDE = 768;
const MAX_BYTES = 50_000;
const MIN_QUALITY = 0.45;

export type ImageCrop = {
  x: number;
  y: number;
  size: number;
};

export async function compressImage(file: File, crop?: ImageCrop): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const bitmap = await createImageBitmap(file);
  const sourceX = crop ? Math.max(0, Math.round(crop.x)) : 0;
  const sourceY = crop ? Math.max(0, Math.round(crop.y)) : 0;
  const sourceSize = crop
    ? Math.max(1, Math.min(Math.round(crop.size), bitmap.width - sourceX, bitmap.height - sourceY))
    : Math.min(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_SIDE / sourceSize);
  const width = Math.max(1, Math.round(sourceSize * scale));
  const height = width;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Your browser could not process this image.');
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, width, height);
  bitmap.close();

  let quality = 0.86;
  let blob = await canvasToWebp(canvas, quality);

  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08);
    blob = await canvasToWebp(canvas, quality);
  }

  if (blob.size > MAX_BYTES) {
    throw new Error('The image is still larger than 50 KB after compression. Try a smaller source image.');
  }

  return { blob, width, height };
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode image as WebP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}
