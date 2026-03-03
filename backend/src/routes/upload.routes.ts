import express, { Request, Response } from "express";
// import { s3Service } from "../services/s3.service"; // LEGACY S3 - Switched to Google Drive
import { googleDriveService } from "../services/google-drive.service"; // OAuth2 - Required for Gmail free accounts
// import { googleDriveSAService } from "../services/google-drive-sa.service"; // Service Account requires Google Workspace (Shared Drive)
import {
  uploadSingle,
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { authenticateWithAutoRefresh } from "../middleware/auth.middleware";

const router = express.Router();

// Single file upload
router.post(
  "/single",
  authenticateWithAutoRefresh,
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

      // Upload to Google Drive (OAuth2)
      const result = await googleDriveService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        folder
      );

      res.json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
        message: "File uploaded successfully",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Upload failed",
      });
    }
  }
);

// Multiple files upload
router.post(
  "/multiple",
  authenticateWithAutoRefresh,
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

      // Prepare files for upload
      const files = req.files.map((file: any) => ({
        buffer: file.buffer,
        filename: file.originalname,
      }));

      // Upload to Google Drive (OAuth2)
      const results = await googleDriveService.uploadFiles(files, folder);

      res.json({
        success: true,
        data: results.map((result, index) => ({
          url: result.url,
          key: result.key,
          filename: (req.files as any)[index].originalname,
          size: (req.files as any)[index].size,
          mimetype: (req.files as any)[index].mimetype,
        })),
        message: `${results.length} files uploaded successfully`,
      });
    } catch (error: any) {
      console.error("Multiple upload error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Upload failed",
      });
    }
  }
);

// Delete file
router.delete(
  "/delete",
  authenticateWithAutoRefresh,
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
    } catch (error: any) {
      console.error("Delete error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Delete failed",
      });
    }
  }
);

// Get public URL (Google Drive doesn't need signed URLs - files are already public)
router.get(
  "/signed-url",
  authenticateWithAutoRefresh,
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
    } catch (error: any) {
      console.error("Public URL error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to get public URL",
      });
    }
  }
);

export default router;
