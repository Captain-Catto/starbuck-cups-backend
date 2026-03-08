import { Request, Response } from "express";
import { Setting } from "../models";
import { socketService } from "../services/socket.service";
import {
  getProductWatermarkSettings,
  updateProductWatermarkSettings,
} from "../services/watermark-settings.service";

export interface EffectSettingsDto {
  enabled: boolean;
  activeEffects: string[];
  intensity: 'low' | 'medium' | 'high';
  redEnvelopeSettings?: any;
  snowSettings?: any;
  excludedPaths?: string[];
}

const EFFECT_SETTINGS_KEY = "effectSettings";

const DEFAULT_RED_ENVELOPE_SETTINGS = {
  fallSpeed: 0.3,
  rotationSpeed: 1.0,
  windStrength: 0.3,
  sparkleFrequency: 0.02,
  quantity: 25,
  minSize: 0.8,
  maxSize: 1.2,
  flipSpeed: 1.0,
  swaySpeed: 1.0,
  hue: 0,
};

const DEFAULT_SNOW_SETTINGS = {
  speed: 1.0,
  density: 1.0,
  size: 1.0,
  windStrength: 0.2,
};

const DEFAULT_EFFECT_SETTINGS: EffectSettingsDto = {
  enabled: false,
  activeEffects: [],
  intensity: "medium",
  redEnvelopeSettings: DEFAULT_RED_ENVELOPE_SETTINGS,
  snowSettings: DEFAULT_SNOW_SETTINGS,
  excludedPaths: [],
};

export const getEffectSettings = async (req: Request, res: Response) => {
  try {
    const setting = await Setting.findOne({
      where: { key: EFFECT_SETTINGS_KEY },
    });

    if (!setting) {
      return res.status(200).json({
        success: true,
        data: DEFAULT_EFFECT_SETTINGS,
      });
    }

    // Merge with defaults to ensure all fields exist
    let storedValue = setting.value;
    if (typeof storedValue === 'string') {
      try {
        storedValue = JSON.parse(storedValue);
      } catch (e) {
        console.error("Error parsing settings value:", e);
        storedValue = {};
      }
    }

    const mergedSettings = {
        ...DEFAULT_EFFECT_SETTINGS,
        ...(storedValue as EffectSettingsDto),
        redEnvelopeSettings: {
            ...DEFAULT_RED_ENVELOPE_SETTINGS,
            ...((storedValue as any).redEnvelopeSettings || {})
        },
        snowSettings: {
            ...DEFAULT_SNOW_SETTINGS,
            ...((storedValue as any).snowSettings || {})
        }
    };

    return res.status(200).json({
      success: true,
      data: mergedSettings,
    });
  } catch (error) {
    console.error("Error fetching effect settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch effect settings",
    });
  }
};

export const updateEffectSettings = async (req: Request, res: Response) => {
  try {
    const payload: EffectSettingsDto = req.body;

    // Deep merge with defaults
    const mergedSettings = {
        ...DEFAULT_EFFECT_SETTINGS,
        ...payload,
        redEnvelopeSettings: {
            ...DEFAULT_RED_ENVELOPE_SETTINGS,
            ...(payload.redEnvelopeSettings || {})
        },
        snowSettings: {
            ...DEFAULT_SNOW_SETTINGS,
            ...(payload.snowSettings || {})
        }
    };

    let setting = await Setting.findOne({
      where: { key: EFFECT_SETTINGS_KEY },
    });

    if (setting) {
      setting.value = mergedSettings;
      // Force change detection for JSON column
      setting.changed("value", true);
      await setting.save();
    } else {
      await Setting.create({
        key: EFFECT_SETTINGS_KEY,
        value: mergedSettings,
      });
    }

    // Broadcast update via Socket.IO
    socketService.emitSettingsUpdate(mergedSettings);

    return res.status(200).json({
      success: true,
      data: mergedSettings,
      message: "Effect settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating effect settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update effect settings",
    });
  }
};

export const getWatermarkSettings = async (req: Request, res: Response) => {
  try {
    const settings = await getProductWatermarkSettings();
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching watermark settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch watermark settings",
    });
  }
};

export const updateWatermarkSettings = async (req: Request, res: Response) => {
  try {
    const payload = req.body as {
      enabled?: boolean;
      text?: string;
      opacity?: number;
      backgroundOpacity?: number;
      fontSize?: number;
      margin?: number;
    };

    const updated = await updateProductWatermarkSettings(payload);

    return res.status(200).json({
      success: true,
      data: updated,
      message: "Watermark settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating watermark settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update watermark settings",
    });
  }
};
