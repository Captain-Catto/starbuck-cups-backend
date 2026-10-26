import { getErrorMessage } from "@/utils/error-helpers";
import { logger } from "@/utils/logger";
import express, { Request, Response } from "express";
import { googleDriveService } from "../services/google-drive.service"; // OAuth2 - Required for Gmail free accounts
import {
  uploadSingle,
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { authenticateWithAutoRefresh, requirePermission } from "../middleware/auth.middleware";
import {
  processImage,
  processImages,
  IMAGE_PRESETS,
} from "../services/image-processing.service";
import { getProductImageProcessingOptions } from "../services/watermark-settings.service";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// Single file upload
router.post(
  "/single",
  authenticateWithAutoRefresh,
  requirePermission(
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.HERO_IMAGES_MANAGE,
    PERMISSIONS.BANNERS_MANAGE
  ),
  uploadSingle("image"),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file provided",
        });
        return;
      }

      const folder = req.body.folder || "uploads";

      // Validate folder name for admin uploads
      const allowedFolders = [
        "products",
        "categories",
        "colors",
        "avatars",
        "uploads",
      ];
      if (!allowedFolders.includes(folder)) {
        res.status(400).json({
          success: false,
          message: "Invalid folder name",
        });
        return;
      }

      // Determine processing preset based on folder
      const preset =
        folder === "products"
          ? await getProductImageProcessingOptions()
          : folder === "avatars" || folder === "categories"
            ? IMAGE_PRESETS.thumbnail
            : IMAGE_PRESETS.product;

      // Resize & convert to AVIF before uploading
      const processed = await processImage(
        req.file.buffer,
        req.file.originalname,
        preset
      );

      // Upload processed image to Google Drive
      const result = await googleDriveService.uploadFile(
        processed.buffer,
        processed.filename,
        folder
      );

      res.json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          filename: processed.filename,
          size: processed.buffer.length,
          mimetype: `image/${processed.format}`,
        },
        message: "File uploaded successfully",
      });
    } catch (error) {
      logger.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: getErrorMessage(error) || "Upload failed",
      });
    }
  }
);

// Multiple files upload
router.post(
  "/multiple",
  authenticateWithAutoRefresh,
  requirePermission(
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.HERO_IMAGES_MANAGE,
    PERMISSIONS.BANNERS_MANAGE
  ),
  uploadMultiple("images", 10),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          message: "No files provided",
        });
        return;
      }

      const folder = req.body.folder || "uploads";

      // Validate folder name
      const allowedFolders = [
        "products",
        "categories",
        "colors",
        "avatars",
        "uploads",
      ];
      if (!allowedFolders.includes(folder)) {
        res.status(400).json({
          success: false,
          message: "Invalid folder name",
        });
        return;
      }

      // Determine processing preset based on folder
      const preset =
        folder === "products"
          ? await getProductImageProcessingOptions()
          : folder === "avatars" || folder === "categories"
            ? IMAGE_PRESETS.thumbnail
            : IMAGE_PRESETS.product;

      // Resize & convert all images to AVIF before uploading
      const originalFiles = req.files.map((file) => ({
        buffer: file.buffer,
        filename: file.originalname,
      }));
      const processedFiles = await processImages(originalFiles, preset);

      // Upload processed images to Google Drive
      const uploadFiles = processedFiles.map((pf) => ({
        buffer: pf.buffer,
        filename: pf.filename,
      }));
      const results = await googleDriveService.uploadFiles(uploadFiles, folder);

      res.json({
        success: true,
        data: results.map((result, index) => ({
          url: result.url,
          key: result.key,
          filename: processedFiles[index].filename,
          size: processedFiles[index].buffer.length,
          mimetype: `image/${processedFiles[index].format}`,
        })),
        message: `${results.length} files uploaded successfully`,
      });
    } catch (error) {
      logger.error("Multiple upload error:", error);
      res.status(500).json({
        success: false,
        message: getErrorMessage(error) || "Upload failed",
      });
    }
  }
);

// Delete file
router.delete(
  "/delete",
  authenticateWithAutoRefresh,
  requirePermission(
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.HERO_IMAGES_MANAGE,
    PERMISSIONS.BANNERS_MANAGE
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const key = req.query.key as string; // Use query parameter

      if (!key) {
        res.status(400).json({
          success: false,
          message: "File key is required",
        });
        return;
      }

      // Check if file exists
      const exists = await googleDriveService.fileExists(key);
      if (!exists) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Delete from Google Drive (OAuth2)
      await googleDriveService.deleteFile(key);

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      logger.error("Delete error:", error);
      res.status(500).json({
        success: false,
        message: getErrorMessage(error) || "Delete failed",
      });
    }
  }
);

// Get public URL (Google Drive doesn't need signed URLs - files are already public)
router.get(
  "/signed-url",
  authenticateWithAutoRefresh,
  requirePermission(
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.HERO_IMAGES_MANAGE,
    PERMISSIONS.BANNERS_MANAGE
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const key = req.query.key as string; // Use query parameter (file ID)

      if (!key) {
        res.status(400).json({
          success: false,
          message: "File key is required",
        });
        return;
      }

      // Check if file exists
      const exists = await googleDriveService.fileExists(key);
      if (!exists) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Get public URL (Google Drive files are already public)
      const publicUrl = googleDriveService.getPublicUrl(key);

      res.json({
        success: true,
        data: {
          url: publicUrl,
          expires: null, // Google Drive public URLs don't expire
        },
        message: "Public URL retrieved successfully",
      });
    } catch (error) {
      logger.error("Public URL error:", error);
      res.status(500).json({
        success: false,
        message: getErrorMessage(error) || "Failed to get public URL",
      });
    }
  }
);

export default router;
