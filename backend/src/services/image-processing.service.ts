import { logger } from "@/utils/logger";
import sharp from "sharp";

export interface WatermarkOptions {
  /** Enable/disable watermark rendering */
  enabled?: boolean;
  /** Watermark text content */
  text?: string;
  /** Text opacity 0-1 */
  opacity?: number;
  /** Background opacity 0-1 */
  backgroundOpacity?: number;
  /** Font size in px */
  fontSize?: number;
  /** Distance from right/bottom image edges */
  margin?: number;
}

export interface ImageProcessingOptions {
  /** Max width in pixels. Height auto-scales to maintain aspect ratio */
  maxWidth: number;
  /** Image quality 1-100 (default: 80) */
  quality?: number;
  /** Output format (default: avif) */
  format?: "avif" | "webp" | "jpeg" | "png";
  /** Optional text watermark */
  watermark?: WatermarkOptions;
}

/** Preset configs for different image types */
export const IMAGE_PRESETS = {
  /** Product card images: displayed at 228px, x2 retina = 456px, buffer → 600px */
  product: {
    maxWidth: 600,
    quality: 80,
    format: "avif" as const,
    watermark: {
      enabled: true,
      text: process.env.PRODUCT_WATERMARK_TEXT || "hasron.vn",
      opacity: 0.92,
      backgroundOpacity: 0.4,
      fontSize: 20,
      margin: 12,
    },
  },
  /** Hero banner images: displayed at ~960px, x2 retina → 1920px */
  hero: { maxWidth: 1920, quality: 82, format: "avif" as const },
  /** Category/avatar images */
  thumbnail: { maxWidth: 400, quality: 75, format: "avif" as const },
} as const;

const clampUnit = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildWatermarkSvg = (watermark: WatermarkOptions): Buffer | null => {
  if (watermark.enabled === false) return null;

  const text = (watermark.text || "hasron.vn").trim();
  if (!text) return null;

  const fontSize = Math.max(12, Math.min(40, watermark.fontSize ?? 20));
  const margin = Math.max(4, Math.min(30, watermark.margin ?? 12));
  const textOpacity = clampUnit(watermark.opacity ?? 0.92, 0.92);
  const bgOpacity = clampUnit(watermark.backgroundOpacity ?? 0.4, 0.4);

  // Rough width estimate: average glyph width ~0.62em for Latin text.
  const boxWidth = Math.max(
    110,
    Math.round(text.length * fontSize * 0.62 + 26)
  );
  const boxHeight = Math.max(34, Math.round(fontSize + 18));
  const svgWidth = boxWidth + margin;
  const svgHeight = boxHeight + margin;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
      <rect x="0" y="0" rx="8" ry="8" width="${boxWidth}" height="${boxHeight}" fill="black" fill-opacity="${bgOpacity}" />
      <text
        x="${boxWidth - 10}"
        y="${boxHeight - 11}"
        text-anchor="end"
        font-family="Arial, 'Helvetica Neue', Helvetica, Tahoma, 'Segoe UI', sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="white"
        fill-opacity="${textOpacity}"
      >${escapeXml(text)}</text>
    </svg>
  `.trim();

  return Buffer.from(svg);
};

/**
 * Process (resize + convert) an image buffer before upload.
 * - Resizes to maxWidth if the image is larger (maintains aspect ratio)
 * - Converts to AVIF for best compression
 * - Strips EXIF metadata to reduce size and protect privacy
 *
 * Returns the processed buffer and the new filename (with .avif extension).
 */
export async function processImage(
  buffer: Buffer,
  filename: string,
  options: ImageProcessingOptions
): Promise<{ buffer: Buffer; filename: string; format: string }> {
  const { maxWidth, quality = 80, format = "avif", watermark } = options;

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

  // Add watermark before output encoding.
  const watermarkSvg = buildWatermarkSvg(watermark || {});
  if (watermarkSvg) {
    pipeline = pipeline.composite([
      {
        input: watermarkSvg,
        gravity: "southeast",
      },
    ]);
  }

  // Convert to target format
  switch (format) {
    case "avif":
      pipeline = pipeline.avif({ quality, effort: 4, chromaSubsampling: "4:2:0" });
      break;
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

  logger.info(
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
