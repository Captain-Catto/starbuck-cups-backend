import express, { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import {
  uploadSingle,
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Single file upload
router.post(
  "/single",
  authenticate,
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

      // Upload to S3
      const result = await s3Service.uploadFile(
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
  authenticate,
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

      // Upload to S3
      const results = await s3Service.uploadFiles(files, folder);

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
  authenticate,
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
      const exists = await s3Service.fileExists(key);
      if (!exists) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Delete from S3
      await s3Service.deleteFile(key);

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

// Get signed URL for temporary access
router.get(
  "/signed-url",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const key = req.query.key as string; // Use query parameter
      const expires = parseInt(req.query.expires as string) || 3600; // 1 hour default

      if (!key) {
        res.status(400).json({
          success: false,
          message: "File key is required",
        });
        return;
      }

      // Check if file exists
      const exists = await s3Service.fileExists(key);
      if (!exists) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Generate signed URL
      const signedUrl = s3Service.getSignedUrl(key, expires);

      res.json({
        success: true,
        data: {
          url: signedUrl,
          expires: expires,
        },
        message: "Signed URL generated successfully",
      });
    } catch (error: any) {
      console.error("Signed URL error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to generate signed URL",
      });
    }
  }
);

export default router;
