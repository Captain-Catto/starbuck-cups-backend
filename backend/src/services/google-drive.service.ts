import { logger } from "@/utils/logger";
import { google, drive_v3 } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { Readable } from "stream";

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export class GoogleDriveService {
  private drive: drive_v3.Drive;
  private folderId: string;

  constructor() {
    // Initialize Google Drive API with OAuth2
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground" // Redirect URI
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    this.drive = google.drive({ version: "v3", auth });
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "root";
  }

  /**
   * Upload file to Google Drive
   * @param file - File buffer
   * @param filename - Original filename
   * @param folder - Folder name (will be created if doesn't exist)
   * @returns Promise<UploadResult>
   */
  async uploadFile(
    file: Buffer,
    filename: string,
    folder: string = "uploads"
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const fileExtension = path.extname(filename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;

      // Upload directly to root folder (GOOGLE_DRIVE_FOLDER_ID)
      const folderId = this.folderId;

      // Convert buffer to readable stream
      const bufferStream = new Readable();
      bufferStream.push(file);
      bufferStream.push(null);

      // Upload file metadata and content
      const fileMetadata: drive_v3.Schema$File = {
        name: uniqueFilename,
        parents: [folderId],
      };

      const media = {
        mimeType: this.getContentType(fileExtension),
        body: bufferStream,
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, webContentLink",
      });

      const fileId = response.data.id!;

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Get public URL
      const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      return {
        url: publicUrl,
        key: fileId,
        bucket: folder,
      };
    } catch (error: any) {
      logger.error("Google Drive upload error:", error);
      throw new Error(
        `Failed to upload file to Google Drive: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Upload multiple files to Google Drive
   */
  async uploadFiles(
    files: Array<{ buffer: Buffer; filename: string }>,
    folder: string = "uploads"
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, file.filename, folder)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
    } catch (error: any) {
      logger.error("Google Drive delete error:", error);
      throw new Error(
        `Failed to delete file from Google Drive: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Delete multiple files from Google Drive
   */
  async deleteFiles(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;

    try {
      const deletePromises = fileIds.map((fileId) => this.deleteFile(fileId));
      await Promise.all(deletePromises);
    } catch (error: any) {
      logger.error("Google Drive bulk delete error:", error);
      throw new Error(
        `Failed to delete files from Google Drive: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Check if file exists in Google Drive
   */
  async fileExists(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.get({
        fileId: fileId,
        fields: "id",
      });
      return true;
    } catch (error: any) {
      if (error?.code === 404) {
        return false;
      }
      throw error;
    }
  }


  /**
   * Get content type based on file extension
   */
  private getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return contentTypes[extension.toLowerCase()] || "application/octet-stream";
  }

  /**
   * Validate file type for images
   */
  isValidImageType(filename: string): boolean {
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];
    const extension = path.extname(filename).toLowerCase();
    return validExtensions.includes(extension);
  }

  /**
   * Get public URL from file ID
   */
  getPublicUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  /**
   * Extract Google Drive file ID from URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // URL format: https://drive.google.com/uc?export=view&id=FILE_ID
      // OR: https://drive.google.com/file/d/FILE_ID/view

      if (url.includes("drive.google.com/uc?")) {
        const urlParams = new URLSearchParams(url.split("?")[1]);
        return urlParams.get("id");
      }

      if (url.includes("drive.google.com/file/d/")) {
        const matches = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        return matches ? matches[1] : null;
      }

      return null;
    } catch (error) {
      logger.error("Error extracting file ID from URL:", error);
      return null;
    }
  }

  /**
   * Extract multiple file IDs from URLs
   */
  extractKeysFromUrls(urls: string[]): string[] {
    return urls
      .map((url) => this.extractKeyFromUrl(url))
      .filter((key): key is string => key !== null);
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
