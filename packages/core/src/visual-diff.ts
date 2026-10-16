import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface VisualDiffResult {
  hasVisualChanges: boolean;
  diffImageBuffer: Buffer;
  changedPixels: number;
  totalPixels: number;
  changedPixelRatio: number;
  width: number;
  height: number;
}

export function computeVisualDiff(
  imgBuffer1: Buffer,
  imgBuffer2: Buffer,
  threshold = 0.1
): VisualDiffResult {
  const img1 = PNG.sync.read(imgBuffer1);
  const img2 = PNG.sync.read(imgBuffer2);

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  const normalizedImg1 = normalizeImageSize(img1, width, height);
  const normalizedImg2 = normalizeImageSize(img2, width, height);

  const diffPng = new PNG({ width, height });

  const totalPixels = width * height;
  const changedPixels = pixelmatch(
    normalizedImg1.data,
    normalizedImg2.data,
    diffPng.data,
    width,
    height,
    {
      threshold,
      includeAA: false,
      diffColor: [255, 0, 85], // Vibrant magenta/pink for diff highlighting
    }
  );

  const diffImageBuffer = PNG.sync.write(diffPng);
  const changedPixelRatio = totalPixels > 0 ? Number((changedPixels / totalPixels).toFixed(6)) : 0;

  return {
    hasVisualChanges: changedPixels > 0,
    diffImageBuffer,
    changedPixels,
    totalPixels,
    changedPixelRatio,
    width,
    height,
  };
}

function normalizeImageSize(img: PNG, targetWidth: number, targetHeight: number): PNG {
  if (img.width === targetWidth && img.height === targetHeight) {
    return img;
  }

  const padded = new PNG({ width: targetWidth, height: targetHeight });
  // Fill with white/opaque background
  padded.data.fill(255);

  // Copy rows from img to padded
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const srcIdx = (img.width * y + x) << 2;
      const dstIdx = (targetWidth * y + x) << 2;
      padded.data[dstIdx] = img.data[srcIdx];
      padded.data[dstIdx + 1] = img.data[srcIdx + 1];
      padded.data[dstIdx + 2] = img.data[srcIdx + 2];
      padded.data[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }

  return padded;
}
