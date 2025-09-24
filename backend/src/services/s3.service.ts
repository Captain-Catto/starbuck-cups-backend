import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export class S3Service {
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "starbucks-shop";
  }

  /**
   * Upload file to S3
   * @param file - File buffer
   * @param filename - Original filename
   * @param folder - S3 folder path (e.g., 'products', 'categories')
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
      const key = `${folder}/${uniqueFilename}`;

      // Upload parameters
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: this.getContentType(fileExtension),
        // ACL removed - bucket should have public read policy instead
      };

      // Upload to S3
      const result = await s3.upload(uploadParams).promise();

      return {
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket,
      };
    } catch (error: any) {
      console.error("S3 upload error:", error);
      throw new Error(
        `Failed to upload file to S3: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Upload multiple files to S3
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
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await s3
        .deleteObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();
    } catch (error: any) {
      console.error("S3 delete error:", error);
      throw new Error(
        `Failed to delete file from S3: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await s3
        .deleteObjects({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
          },
        })
        .promise();
    } catch (error: any) {
      console.error("S3 bulk delete error:", error);
      throw new Error(
        `Failed to delete files from S3: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get signed URL for temporary access
   */
  getSignedUrl(key: string, expires: number = 3600): string {
    return s3.getSignedUrl("getObject", {
      Bucket: this.bucket,
      Key: key,
      Expires: expires,
    });
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await s3
        .headObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();
      return true;
    } catch (error: any) {
      if (error?.code === "NotFound") {
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
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const extension = path.extname(filename).toLowerCase();
    return validExtensions.includes(extension);
  }

  /**
   * Get public URL from S3 key
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from full URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // URL format: https://bucket.s3.region.amazonaws.com/key
      const urlParts = url.split('/');
      const domainParts = urlParts[2].split('.');

      // Check if it's an S3 URL
      if (domainParts.includes('s3') && domainParts.includes('amazonaws')) {
        return urlParts.slice(3).join('/'); // Get everything after domain
      }

      return null;
    } catch (error) {
      console.error('Error extracting key from URL:', error);
      return null;
    }
  }

  /**
   * Extract multiple S3 keys from URLs
   */
  extractKeysFromUrls(urls: string[]): string[] {
    return urls
      .map(url => this.extractKeyFromUrl(url))
      .filter((key): key is string => key !== null);
  }
}

// Export singleton instance
export const s3Service = new S3Service();
