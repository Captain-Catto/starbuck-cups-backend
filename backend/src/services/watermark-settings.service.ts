import { Setting } from "../models";
import {
  IMAGE_PRESETS,
  ImageProcessingOptions,
  WatermarkOptions,
} from "./image-processing.service";

const WATERMARK_SETTINGS_KEY = "productWatermarkSettings";
const CACHE_TTL_MS = 30_000;

export interface ProductWatermarkSettingsDto {
  enabled: boolean;
  text: string;
  opacity: number;
  backgroundOpacity: number;
  fontSize: number;
  margin: number;
}

const DEFAULT_PRODUCT_WATERMARK_SETTINGS: ProductWatermarkSettingsDto = {
  enabled: true,
  text: process.env.PRODUCT_WATERMARK_TEXT || "hasron.vn",
  opacity: 0.92,
  backgroundOpacity: 0.4,
  fontSize: 20,
  margin: 12,
};

let watermarkCache:
  | { value: ProductWatermarkSettingsDto; expiresAt: number }
  | null = null;

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const parseStoredValue = (raw: unknown): Partial<ProductWatermarkSettingsDto> => {
  if (!raw) return {};

  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Partial<ProductWatermarkSettingsDto>;
};

const sanitizeWatermarkSettings = (
  input: Partial<ProductWatermarkSettingsDto>
): ProductWatermarkSettingsDto => {
  const text =
    typeof input.text === "string" && input.text.trim()
      ? input.text.trim()
      : DEFAULT_PRODUCT_WATERMARK_SETTINGS.text;

  return {
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : DEFAULT_PRODUCT_WATERMARK_SETTINGS.enabled,
    text,
    opacity:
      input.opacity !== undefined
        ? clamp(Number(input.opacity), 0, 1)
        : DEFAULT_PRODUCT_WATERMARK_SETTINGS.opacity,
    backgroundOpacity:
      input.backgroundOpacity !== undefined
        ? clamp(Number(input.backgroundOpacity), 0, 1)
        : DEFAULT_PRODUCT_WATERMARK_SETTINGS.backgroundOpacity,
    fontSize:
      input.fontSize !== undefined
        ? clamp(Number(input.fontSize), 12, 40)
        : DEFAULT_PRODUCT_WATERMARK_SETTINGS.fontSize,
    margin:
      input.margin !== undefined
        ? clamp(Number(input.margin), 4, 30)
        : DEFAULT_PRODUCT_WATERMARK_SETTINGS.margin,
  };
};

export const getDefaultProductWatermarkSettings =
  (): ProductWatermarkSettingsDto => ({ ...DEFAULT_PRODUCT_WATERMARK_SETTINGS });

export const getProductWatermarkSettings =
  async (): Promise<ProductWatermarkSettingsDto> => {
    const now = Date.now();
    if (watermarkCache && watermarkCache.expiresAt > now) {
      return { ...watermarkCache.value };
    }

    const setting = await Setting.findOne({
      where: { key: WATERMARK_SETTINGS_KEY },
    });

    if (!setting) {
      const defaults = getDefaultProductWatermarkSettings();
      watermarkCache = {
        value: defaults,
        expiresAt: now + CACHE_TTL_MS,
      };
      return defaults;
    }

    const parsed = parseStoredValue(setting.value);
    const sanitized = sanitizeWatermarkSettings(parsed);

    watermarkCache = {
      value: sanitized,
      expiresAt: now + CACHE_TTL_MS,
    };

    return { ...sanitized };
  };

export const updateProductWatermarkSettings = async (
  payload: Partial<ProductWatermarkSettingsDto>
): Promise<ProductWatermarkSettingsDto> => {
  const current = await getProductWatermarkSettings();
  const next = sanitizeWatermarkSettings({
    ...current,
    ...payload,
  });

  const [setting] = await Setting.findOrCreate({
    where: { key: WATERMARK_SETTINGS_KEY },
    defaults: {
      key: WATERMARK_SETTINGS_KEY,
      value: next,
      description: "Product image watermark settings",
    },
  });

  setting.value = next;
  setting.changed("value", true);
  if (!setting.description) {
    setting.description = "Product image watermark settings";
  }
  await setting.save();

  watermarkCache = {
    value: next,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return { ...next };
};

export const getProductImageProcessingOptions =
  async (): Promise<ImageProcessingOptions> => {
    const productPreset = IMAGE_PRESETS.product;
    const watermarkSettings = await getProductWatermarkSettings();

    const presetWatermark: WatermarkOptions = {
      ...(productPreset.watermark || {}),
      ...watermarkSettings,
    };

    return {
      ...productPreset,
      watermark: presetWatermark,
    };
  };
