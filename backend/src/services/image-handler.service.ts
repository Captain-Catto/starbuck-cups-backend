/**
 * Image Handler Service
 * Provides high-level image management with automatic rollback capabilities
 */
import { s3Service } from './s3.service';

export interface ImageUploadResult {
  urls: string[];
  keys: string[];
  success: boolean;
  error?: string;
}

export interface ImageCleanupResult {
  deletedCount: number;
  failedCount: number;
  errors: string[];
}

export class ImageHandlerService {
  /**
   * Upload images with validation and return both URLs and keys for rollback
   */
  async uploadProductImages(
    files: Express.Multer.File[],
    folder: string = 'products'
  ): Promise<ImageUploadResult> {
    try {
      // Validate all files first before uploading any
      for (const file of files) {
        if (!s3Service.isValidImageType(file.originalname)) {
          return {
            urls: [],
            keys: [],
            success: false,
            error: `Invalid file type: ${file.originalname}. Only images are allowed.`
          };
        }
      }

      // Upload all files
      const uploadFiles = files.map(file => ({
        buffer: file.buffer,
        filename: file.originalname,
      }));

      const uploadResults = await s3Service.uploadFiles(uploadFiles, folder);

      return {
        urls: uploadResults.map(result => result.url),
        keys: uploadResults.map(result => result.key),
        success: true
      };

    } catch (error) {
      console.error('Image upload error:', error);
      return {
        urls: [],
        keys: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Clean up uploaded images (rollback mechanism)
   */
  async cleanupImages(keys: string[]): Promise<ImageCleanupResult> {
    if (!keys || keys.length === 0) {
      return {
        deletedCount: 0,
        failedCount: 0,
        errors: []
      };
    }

    try {
      await s3Service.deleteFiles(keys);
      console.log(`Successfully cleaned up ${keys.length} images from S3`);

      return {
        deletedCount: keys.length,
        failedCount: 0,
        errors: []
      };

    } catch (error) {
      console.error('Image cleanup error:', error);

      return {
        deletedCount: 0,
        failedCount: keys.length,
        errors: [error instanceof Error ? error.message : 'Unknown cleanup error']
      };
    }
  }

  /**
   * Replace existing images with new ones (for updates)
   * This will upload new images first, then delete old ones only if upload succeeds
   */
  async replaceProductImages(
    oldImageUrls: string[],
    newFiles: Express.Multer.File[],
    folder: string = 'products'
  ): Promise<ImageUploadResult & { oldImagesDeleted?: boolean }> {
    // Step 1: Upload new images first
    const uploadResult = await this.uploadProductImages(newFiles, folder);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Step 2: Delete old images if upload was successful
    let oldImagesDeleted = false;
    if (oldImageUrls.length > 0) {
      try {
        const oldKeys = s3Service.extractKeysFromUrls(oldImageUrls);
        if (oldKeys.length > 0) {
          await s3Service.deleteFiles(oldKeys);
          oldImagesDeleted = true;
          console.log(`Successfully replaced ${oldKeys.length} old images with ${uploadResult.urls.length} new images`);
        }
      } catch (deleteError) {
        // Log error but don't fail the operation since new images are uploaded
        console.error('Error deleting old images during replacement:', deleteError);
      }
    }

    return {
      ...uploadResult,
      oldImagesDeleted
    };
  }

  /**
   * Merge existing images with new ones (for partial updates)
   */
  async mergeProductImages(
    existingImageUrls: string[],
    newFiles: Express.Multer.File[],
    folder: string = 'products'
  ): Promise<ImageUploadResult> {
    if (!newFiles || newFiles.length === 0) {
      return {
        urls: existingImageUrls,
        keys: [],
        success: true
      };
    }

    const uploadResult = await this.uploadProductImages(newFiles, folder);

    if (!uploadResult.success) {
      return uploadResult;
    }

    return {
      urls: [...existingImageUrls, ...uploadResult.urls],
      keys: uploadResult.keys,
      success: true
    };
  }

  /**
   * Validate image files without uploading
   */
  validateImageFiles(files: Express.Multer.File[]): { valid: boolean; error?: string } {
    for (const file of files) {
      if (!s3Service.isValidImageType(file.originalname)) {
        return {
          valid: false,
          error: `Invalid file type: ${file.originalname}. Only images are allowed.`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Delete product images by URLs
   */
  async deleteProductImagesByUrls(imageUrls: string[]): Promise<ImageCleanupResult> {
    if (!imageUrls || imageUrls.length === 0) {
      return {
        deletedCount: 0,
        failedCount: 0,
        errors: []
      };
    }

    const keys = s3Service.extractKeysFromUrls(imageUrls);
    return this.cleanupImages(keys);
  }
}

// Export singleton instance
export const imageHandler = new ImageHandlerService();