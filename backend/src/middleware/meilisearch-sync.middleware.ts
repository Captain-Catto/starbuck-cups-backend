/**
 * Middleware để tự động đồng bộ dữ liệu với MeiliSearch
 * khi có thay đổi trong database
 */
import { meilisearchService } from "../services/meilisearch.service";
import type {
  SearchableProduct,
  SearchableCategory,
  SearchableColor,
  SearchableCapacity,
  SearchableCustomer,
} from "../services/meilisearch.service";

export class MeiliSearchSyncMiddleware {
  /**
   * Đồng bộ product khi được tạo hoặc cập nhật
   */
  static async syncProduct(product: any): Promise<void> {
    try {
      const searchableProduct: SearchableProduct = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        stockQuantity: product.stockQuantity,
        isActive: product.isActive,
        categories: product.productCategories?.map((pc: any) => ({
          id: pc.category.id,
          name: pc.category.name,
          slug: pc.category.slug,
        })) || [],
        colors: product.productColors?.map((pc: any) => ({
          id: pc.color.id,
          name: pc.color.name,
          slug: pc.color.slug,
          hexCode: pc.color.hexCode,
        })) || [],
        capacity: {
          id: product.capacity.id,
          name: product.capacity.name,
          slug: product.capacity.slug,
          volumeMl: product.capacity.volumeMl,
        },
        images: product.productImages?.map((img: any) => img.url) || [],
        productUrl: product.productUrl || "",
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };

      await meilisearchService.indexProducts([searchableProduct]);
      console.log(`✅ Product ${product.id} synced to MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to sync product ${product.id} to MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Xóa product khỏi search index
   */
  static async deleteProduct(productId: string): Promise<void> {
    try {
      await meilisearchService.deleteProduct(productId);
      console.log(`✅ Product ${productId} deleted from MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete product ${productId} from MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Đồng bộ category khi được tạo hoặc cập nhật
   */
  static async syncCategory(category: any): Promise<void> {
    try {
      const searchableCategory: SearchableCategory = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        isActive: category.isActive,
        parentId: category.parentId || undefined,
        parent: category.parent
          ? {
              id: category.parent.id,
              name: category.parent.name,
              slug: category.parent.slug,
            }
          : undefined,
      };

      await meilisearchService.indexCategories([searchableCategory]);
      console.log(`✅ Category ${category.id} synced to MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to sync category ${category.id} to MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Xóa category khỏi search index
   */
  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      await meilisearchService.deleteCategory(categoryId);
      console.log(`✅ Category ${categoryId} deleted from MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete category ${categoryId} from MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Đồng bộ color khi được tạo hoặc cập nhật
   */
  static async syncColor(color: any): Promise<void> {
    try {
      const searchableColor: SearchableColor = {
        id: color.id,
        name: color.name,
        slug: color.slug,
        hexCode: color.hexCode,
        isActive: color.isActive,
      };

      await meilisearchService.indexColors([searchableColor]);
      console.log(`✅ Color ${color.id} synced to MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to sync color ${color.id} to MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Xóa color khỏi search index
   */
  static async deleteColor(colorId: string): Promise<void> {
    try {
      await meilisearchService.deleteColor(colorId);
      console.log(`✅ Color ${colorId} deleted from MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete color ${colorId} from MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Đồng bộ capacity khi được tạo hoặc cập nhật
   */
  static async syncCapacity(capacity: any): Promise<void> {
    try {
      const searchableCapacity: SearchableCapacity = {
        id: capacity.id,
        name: capacity.name,
        slug: capacity.slug,
        volumeMl: capacity.volumeMl,
        isActive: capacity.isActive,
      };

      await meilisearchService.indexCapacities([searchableCapacity]);
      console.log(`✅ Capacity ${capacity.id} synced to MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to sync capacity ${capacity.id} to MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Xóa capacity khỏi search index
   */
  static async deleteCapacity(capacityId: string): Promise<void> {
    try {
      await meilisearchService.deleteCapacity(capacityId);
      console.log(`✅ Capacity ${capacityId} deleted from MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete capacity ${capacityId} from MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Đồng bộ customer khi được tạo hoặc cập nhật
   */
  static async syncCustomer(customer: any): Promise<void> {
    try {
      const searchableCustomer: SearchableCustomer = {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        messengerId: customer.messengerId || undefined,
        zaloId: customer.zaloId || undefined,
        notes: customer.notes || undefined,
      };

      await meilisearchService.indexCustomers([searchableCustomer]);
      console.log(`✅ Customer ${customer.id} synced to MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to sync customer ${customer.id} to MeiliSearch:`,
        error
      );
    }
  }

  /**
   * Xóa customer khỏi search index
   */
  static async deleteCustomer(customerId: string): Promise<void> {
    try {
      await meilisearchService.deleteCustomer(customerId);
      console.log(`✅ Customer ${customerId} deleted from MeiliSearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete customer ${customerId} from MeiliSearch:`,
        error
      );
    }
  }
}
