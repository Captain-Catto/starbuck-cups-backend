import { logger } from "@/utils/logger";
import {
  Capacity,
  Category,
  Color,
  Customer,
  CustomerPhone,
  Product,
  ProductCategory,
  ProductColor,
  ProductImage,
} from "../models";
import {
  meilisearchService,
  type SearchableCapacity,
  type SearchableCategory,
  type SearchableColor,
  type SearchableCustomer,
  type SearchableProduct,
} from "../services/meilisearch.service";

export class MeiliSearchSyncMiddleware {
  static async syncProductById(productId: string): Promise<void> {
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: ProductCategory,
          as: "productCategories",
          include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: Capacity,
          as: "capacity",
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["url", "order"],
        },
      ],
      order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
    });

    if (!product || product.isDeleted || !product.capacity) {
      await this.deleteProduct(productId);
      return;
    }

    const searchableProduct: SearchableProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      stockQuantity: product.stockQuantity,
      isActive: product.isActive,
      categories: (product.productCategories || [])
        .filter((pc: any) => pc.category)
        .map((pc: any) => ({
          id: pc.category.id,
          name: pc.category.name,
          slug: pc.category.slug,
        })),
      colors: (product.productColors || [])
        .filter((pc: any) => pc.color)
        .map((pc: any) => ({
          id: pc.color.id,
          name: pc.color.name,
          slug: pc.color.slug,
          hexCode: pc.color.hexCode,
        })),
      capacity: {
        id: (product.capacity as any).id,
        name: (product.capacity as any).name,
        slug: (product.capacity as any).slug,
        volumeMl: (product.capacity as any).volumeMl,
      },
      images: (product.productImages || []).map((img: any) => img.url),
      productUrl: product.productUrl || "",
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    await meilisearchService.indexProducts([searchableProduct]);
    logger.info(`✅ Product ${productId} synced to MeiliSearch`);
  }

  static async deleteProduct(productId: string): Promise<void> {
    await meilisearchService.deleteProduct(productId);
    logger.info(`✅ Product ${productId} deleted from MeiliSearch`);
  }

  static async syncCategoryById(categoryId: string): Promise<void> {
    const category = await Category.findByPk(categoryId, {
      include: [{ model: Category, as: "parent", attributes: ["id", "name", "slug"] }],
    });

    if (!category) {
      await this.deleteCategory(categoryId);
      return;
    }

    const searchableCategory: SearchableCategory = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      isActive: category.isActive,
      parentId: category.parentId || undefined,
      parent: (category as any).parent
        ? {
            id: (category as any).parent.id,
            name: (category as any).parent.name,
            slug: (category as any).parent.slug,
          }
        : undefined,
    };

    await meilisearchService.indexCategories([searchableCategory]);
    logger.info(`✅ Category ${categoryId} synced to MeiliSearch`);
  }

  static async deleteCategory(categoryId: string): Promise<void> {
    await meilisearchService.deleteCategory(categoryId);
    logger.info(`✅ Category ${categoryId} deleted from MeiliSearch`);
  }

  static async syncColorById(colorId: string): Promise<void> {
    const color = await Color.findByPk(colorId);

    if (!color) {
      await this.deleteColor(colorId);
      return;
    }

    const searchableColor: SearchableColor = {
      id: color.id,
      name: color.name,
      slug: color.slug,
      hexCode: color.hexCode,
      isActive: color.isActive,
    };

    await meilisearchService.indexColors([searchableColor]);
    logger.info(`✅ Color ${colorId} synced to MeiliSearch`);
  }

  static async deleteColor(colorId: string): Promise<void> {
    await meilisearchService.deleteColor(colorId);
    logger.info(`✅ Color ${colorId} deleted from MeiliSearch`);
  }

  static async syncCapacityById(capacityId: string): Promise<void> {
    const capacity = await Capacity.findByPk(capacityId);

    if (!capacity) {
      await this.deleteCapacity(capacityId);
      return;
    }

    const searchableCapacity: SearchableCapacity = {
      id: capacity.id,
      name: capacity.name,
      slug: capacity.slug,
      volumeMl: capacity.volumeMl,
      isActive: capacity.isActive,
    };

    await meilisearchService.indexCapacities([searchableCapacity]);
    logger.info(`✅ Capacity ${capacityId} synced to MeiliSearch`);
  }

  static async deleteCapacity(capacityId: string): Promise<void> {
    await meilisearchService.deleteCapacity(capacityId);
    logger.info(`✅ Capacity ${capacityId} deleted from MeiliSearch`);
  }

  static async syncCustomerById(customerId: string): Promise<void> {
    const customer = await Customer.findByPk(customerId, {
      include: [
        {
          model: CustomerPhone,
          as: "customerPhones",
          attributes: ["phoneNumber", "isMain"],
        },
      ],
    });

    if (!customer) {
      await this.deleteCustomer(customerId);
      return;
    }

    const phones = (customer as any).customerPhones || [];
    const mainPhone =
      phones.find((phone: any) => phone.isMain)?.phoneNumber ||
      phones[0]?.phoneNumber ||
      "";

    const searchableCustomer: SearchableCustomer = {
      id: customer.id,
      fullName: customer.fullName,
      phone: mainPhone,
      messengerId: customer.messengerId || undefined,
      zaloId: customer.zaloId || undefined,
      notes: customer.notes || undefined,
    };

    await meilisearchService.indexCustomers([searchableCustomer]);
    logger.info(`✅ Customer ${customerId} synced to MeiliSearch`);
  }

  static async deleteCustomer(customerId: string): Promise<void> {
    await meilisearchService.deleteCustomer(customerId);
    logger.info(`✅ Customer ${customerId} deleted from MeiliSearch`);
  }
}
