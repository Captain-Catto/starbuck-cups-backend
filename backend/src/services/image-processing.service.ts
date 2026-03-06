import sharp from "sharp";

export interface ImageProcessingOptions {
  /** Max width in pixels. Height auto-scales to maintain aspect ratio */
  maxWidth: number;
  /** WebP quality 1-100 (default: 80) */
  quality?: number;
  /** Output format (default: webp) */
  format?: "webp" | "jpeg" | "png";
}

/** Preset configs for different image types */
export const IMAGE_PRESETS = {
  /** Product card images: displayed at 228px, x2 retina = 456px, buffer → 600px */
  product: { maxWidth: 600, quality: 80, format: "webp" as const },
  /** Hero banner images: displayed at ~960px, x2 retina → 1920px */
  hero: { maxWidth: 1920, quality: 82, format: "webp" as const },
  /** Category/avatar images */
  thumbnail: { maxWidth: 400, quality: 75, format: "webp" as const },
} as const;

/**
 * Process (resize + convert) an image buffer before upload.
 * - Resizes to maxWidth if the image is larger (maintains aspect ratio)
 * - Converts to WebP for best compression
 * - Strips EXIF metadata to reduce size and protect privacy
 *
 * Returns the processed buffer and the new filename (with .webp extension).
 */
export async function processImage(
  buffer: Buffer,
  filename: string,
  options: ImageProcessingOptions
): Promise<{ buffer: Buffer; filename: string; format: string }> {
  const { maxWidth, quality = 80, format = "webp" } = options;

  // Get metadata first to decide if resize is needed
  const metadata = await sharp(buffer).metadata();

  // Build pipeline: auto-rotate → conditional resize
  let pipeline = sharp(buffer).rotate(); // auto-rotate based on EXIF orientation

  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  // Convert to target format
  switch (format) {
    case "webp":
      pipeline = pipeline.webp({ quality, effort: 4, smartSubsample: true });
      break;
    case "jpeg":
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
      break;
  }

  // Strip metadata (EXIF, ICC profile, etc.) to reduce file size
  pipeline = pipeline.withMetadata({ orientation: undefined });

  const processedBuffer = await pipeline.toBuffer();

  // Replace file extension with the target format
  const newFilename = filename.replace(/\.[^.]+$/, `.${format}`);

  const originalKB = (buffer.length / 1024).toFixed(1);
  const processedKB = (processedBuffer.length / 1024).toFixed(1);
  const savings = (
    ((buffer.length - processedBuffer.length) / buffer.length) *
    100
  ).toFixed(1);

  console.log(
    `[ImageProcessing] ${filename}: ${originalKB}KB → ${processedKB}KB (${savings}% smaller, ${metadata.width}px → ${Math.min(metadata.width || maxWidth, maxWidth)}px, ${format})`
  );

  return {
    buffer: processedBuffer,
    filename: newFilename,
    format,
  };
}

/**
 * Process multiple images in parallel
 */
export async function processImages(
  files: Array<{ buffer: Buffer; filename: string }>,
  options: ImageProcessingOptions
): Promise<Array<{ buffer: Buffer; filename: string; format: string }>> {
  return Promise.all(
    files.map((file) => processImage(file.buffer, file.filename, options))
  );
}
