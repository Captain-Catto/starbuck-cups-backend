import { ProductImage } from "../models/ProductImage";
import { Product } from "../models/Product";

export interface ProductImageData {
  url: string;
  order: number;
}

export class ProductImageService {
  /**
   * Create product images with order
   */
  async createProductImages(
    productId: string,
    images: ProductImageData[]
  ): Promise<void> {
    // Sort by order to ensure correct sequence
    const sortedImages = images.sort((a, b) => a.order - b.order);

    await ProductImage.bulkCreate(
      sortedImages.map((img) => ({
        productId,
        url: img.url,
        order: img.order,
      }))
    );
  }

  /**
   * Update product images with new order
   */
  async updateProductImages(
    productId: string,
    images: ProductImageData[]
  ): Promise<void> {
    // Delete existing images
    await ProductImage.destroy({
      where: { productId },
    });

    // Create new images with updated order
    if (images.length > 0) {
      await this.createProductImages(productId, images);
    }
  }

  /**
   * Get product images ordered by order field
   */
  async getProductImages(productId: string): Promise<ProductImageData[]> {
    const images = await ProductImage.findAll({
      where: { productId },
      order: [["order", "ASC"]],
      attributes: ["url", "order"],
    });

    return images;
  }

  /**
   * Delete product images
   */
  async deleteProductImages(productId: string): Promise<void> {
    await ProductImage.destroy({
      where: { productId },
    });
  }

  /**
   * Migrate existing JSON images to ProductImage table
   */
  async migrateFromJsonImages(
    productId: string,
    jsonImages: string[]
  ): Promise<void> {
    // Check if already migrated
    const existingCount = await ProductImage.count({
      where: { productId },
    });

    if (existingCount > 0) {
      return; // Already migrated
    }

    // Create ProductImage records
    const imageData = jsonImages.map((url, index) => ({
      url,
      order: index,
    }));

    await this.createProductImages(productId, imageData);
  }

  /**
   * Get images with fallback to JSON field
   */
  async getImagesWithFallback(productId: string): Promise<string[]> {
    // Try to get from ProductImage table first
    const productImages = await this.getProductImages(productId);

    if (productImages.length > 0) {
      return productImages.map((img) => img.url);
    }

    // No legacy images field anymore since we've migrated to ProductImage table
    return [];
  }

  /**
   * Reorder images
   */
  async reorderImages(productId: string, imageUrls: string[]): Promise<void> {
    const imageData = imageUrls.map((url, index) => ({
      url,
      order: index,
    }));

    await this.updateProductImages(productId, imageData);
  }
}

export const productImageService = new ProductImageService();
