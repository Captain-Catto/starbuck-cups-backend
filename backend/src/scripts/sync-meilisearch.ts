import dotenv from "dotenv";
import { initializeDatabase, cleanupDatabase } from "../config/database-init";
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

dotenv.config();

async function syncMeilisearch(): Promise<void> {
  console.log("🔄 Starting MeiliSearch sync...");

  await initializeDatabase();
  await meilisearchService.initializeIndexes();

  const [products, categories, colors, capacities, customers] =
    await Promise.all([
      Product.findAll({
        where: { isDeleted: false },
        include: [
          {
            model: ProductCategory,
            as: "productCategories",
            include: [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ],
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
      }),
      Category.findAll({
        include: [
          {
            model: Category,
            as: "parent",
            attributes: ["id", "name", "slug"],
          },
        ],
      }),
      Color.findAll(),
      Capacity.findAll(),
      Customer.findAll({
        include: [
          {
            model: CustomerPhone,
            as: "customerPhones",
            attributes: ["phoneNumber", "isMain"],
          },
        ],
      }),
    ]);

  const productDocuments: SearchableProduct[] = [];
  for (const product of products as any[]) {
    if (!product.capacity) {
      continue;
    }

    productDocuments.push({
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
        id: product.capacity.id,
        name: product.capacity.name,
        slug: product.capacity.slug,
        volumeMl: product.capacity.volumeMl,
      },
      images: (product.productImages || []).map((image: any) => image.url),
      productUrl: product.productUrl || "",
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  }

  const categoryDocuments: SearchableCategory[] = categories.map(
    (category: any) => ({
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
    })
  );

  const colorDocuments: SearchableColor[] = colors.map((color: any) => ({
    id: color.id,
    name: color.name,
    slug: color.slug,
    hexCode: color.hexCode,
    isActive: color.isActive,
  }));

  const capacityDocuments: SearchableCapacity[] = capacities.map(
    (capacity: any) => ({
      id: capacity.id,
      name: capacity.name,
      slug: capacity.slug,
      volumeMl: capacity.volumeMl,
      isActive: capacity.isActive,
    })
  );

  const customerDocuments: SearchableCustomer[] = customers.map(
    (customer: any) => {
      const mainPhone =
        (customer.customerPhones || []).find((phone: any) => phone.isMain) ||
        (customer.customerPhones || [])[0];

      return {
        id: customer.id,
        fullName: customer.fullName,
        phone: mainPhone?.phoneNumber || "",
        messengerId: customer.messengerId || undefined,
        zaloId: customer.zaloId || undefined,
        notes: customer.notes || undefined,
      };
    }
  );

  await Promise.all([
    meilisearchService.indexProducts(productDocuments),
    meilisearchService.indexCategories(categoryDocuments),
    meilisearchService.indexColors(colorDocuments),
    meilisearchService.indexCapacities(capacityDocuments),
    meilisearchService.indexCustomers(customerDocuments),
  ]);

  const stats = await meilisearchService.getIndexStats();
  console.log("✅ MeiliSearch sync completed");
  console.log(
    `📊 Synced counts: products=${productDocuments.length}, categories=${categoryDocuments.length}, colors=${colorDocuments.length}, capacities=${capacityDocuments.length}, customers=${customerDocuments.length}`
  );
  console.log("📈 Index stats:", stats);
}

syncMeilisearch()
  .then(async () => {
    await cleanupDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Sync failed:", error);
    await cleanupDatabase();
    process.exit(1);
  });
