/**
 * Script to sync all existing data from PostgreSQL to Meilisearch
 */
import { PrismaClient } from "../src/generated/prisma";
import { meilisearchService } from "../src/services/meilisearch.service";
import type {
  SearchableProduct,
  SearchableCategory,
  SearchableColor,
  SearchableCapacity,
  SearchableCustomer,
} from "../src/services/meilisearch.service";

const prisma = new PrismaClient();

async function transformProductForSearch(product: any): Promise<SearchableProduct> {
  // Get product images
  const images = product.productImages && product.productImages.length > 0
    ? product.productImages.map((img: any) => img.url)
    : [];

  // Transform categories array
  const categories = product.productCategories && product.productCategories.length > 0
    ? product.productCategories.map((pc: any) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
      }))
    : [];

  // Transform colors array
  const colors = product.productColors && product.productColors.length > 0
    ? product.productColors.map((pc: any) => ({
        id: pc.color.id,
        name: pc.color.name,
        slug: pc.color.slug,
        hexCode: pc.color.hexCode,
      }))
    : [];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    stockQuantity: product.stockQuantity,
    isActive: product.isActive,
    categories,
    colors,
    capacity: {
      id: product.capacity.id,
      name: product.capacity.name,
      slug: product.capacity.slug,
      volumeMl: product.capacity.volumeMl,
    },
    images,
    productUrl: product.productUrl || "",
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function syncProducts() {
  console.log("📦 Syncing products to Meilisearch...");

  try {
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        productCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        productColors: {
          include: {
            color: {
              select: {
                id: true,
                name: true,
                slug: true,
                hexCode: true,
              },
            },
          },
        },
        capacity: {
          select: {
            id: true,
            name: true,
            slug: true,
            volumeMl: true,
          },
        },
        productImages: {
          select: {
            url: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    console.log(`Found ${products.length} products to sync`);

    if (products.length > 0) {
      const searchableProducts: SearchableProduct[] = await Promise.all(
        products.map(transformProductForSearch)
      );

      await meilisearchService.indexProducts(searchableProducts);
      console.log(`✅ Successfully synced ${products.length} products`);
    } else {
      console.log("ℹ️  No products found to sync");
    }
  } catch (error) {
    console.error("❌ Error syncing products:", error);
    throw error;
  }
}

async function syncCategories() {
  console.log("📂 Syncing categories to Meilisearch...");

  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    console.log(`Found ${categories.length} categories to sync`);

    if (categories.length > 0) {
      const searchableCategories: SearchableCategory[] = categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        isActive: category.isActive,
        parentId: category.parentId || undefined,
        parent: category.parent || undefined,
      }));

      await meilisearchService.indexCategories(searchableCategories);
      console.log(`✅ Successfully synced ${categories.length} categories`);
    } else {
      console.log("ℹ️  No categories found to sync");
    }
  } catch (error) {
    console.error("❌ Error syncing categories:", error);
    throw error;
  }
}

async function syncColors() {
  console.log("🎨 Syncing colors to Meilisearch...");

  try {
    const colors = await prisma.color.findMany({
      where: {
        isActive: true,
      },
    });

    console.log(`Found ${colors.length} colors to sync`);

    if (colors.length > 0) {
      const searchableColors: SearchableColor[] = colors.map((color) => ({
        id: color.id,
        name: color.name,
        slug: color.slug,
        hexCode: color.hexCode,
        isActive: color.isActive,
      }));

      await meilisearchService.indexColors(searchableColors);
      console.log(`✅ Successfully synced ${colors.length} colors`);
    } else {
      console.log("ℹ️  No colors found to sync");
    }
  } catch (error) {
    console.error("❌ Error syncing colors:", error);
    throw error;
  }
}

async function syncCapacities() {
  console.log("📏 Syncing capacities to Meilisearch...");

  try {
    const capacities = await prisma.capacity.findMany({
      where: {
        isActive: true,
      },
    });

    console.log(`Found ${capacities.length} capacities to sync`);

    if (capacities.length > 0) {
      const searchableCapacities: SearchableCapacity[] = capacities.map((capacity) => ({
        id: capacity.id,
        name: capacity.name,
        slug: capacity.slug,
        volumeMl: capacity.volumeMl,
        isActive: capacity.isActive,
      }));

      await meilisearchService.indexCapacities(searchableCapacities);
      console.log(`✅ Successfully synced ${capacities.length} capacities`);
    } else {
      console.log("ℹ️  No capacities found to sync");
    }
  } catch (error) {
    console.error("❌ Error syncing capacities:", error);
    throw error;
  }
}

async function syncCustomers() {
  console.log("👥 Syncing customers to Meilisearch...");

  try {
    const customers = await prisma.customer.findMany();

    console.log(`Found ${customers.length} customers to sync`);

    if (customers.length > 0) {
      const searchableCustomers: SearchableCustomer[] = customers.map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        messengerId: customer.messengerId || undefined,
        zaloId: customer.zaloId || undefined,
        notes: customer.notes || undefined,
      }));

      await meilisearchService.indexCustomers(searchableCustomers);
      console.log(`✅ Successfully synced ${customers.length} customers`);
    } else {
      console.log("ℹ️  No customers found to sync");
    }
  } catch (error) {
    console.error("❌ Error syncing customers:", error);
    throw error;
  }
}

async function syncAllData() {
  console.log("🚀 Starting full data sync to Meilisearch...");

  try {
    // Initialize Meilisearch first
    console.log("🔍 Initializing Meilisearch...");
    await meilisearchService.initializeIndexes();

    // Wait a bit for settings to be applied
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Sync all data types
    await syncProducts();
    await syncCategories();
    await syncColors();
    await syncCapacities();
    await syncCustomers();

    // Wait for indexing to complete and get final stats
    console.log("⏳ Waiting for indexing to complete...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const stats = await meilisearchService.getIndexStats();
    console.log("📊 Final index statistics:");
    console.log(JSON.stringify(stats, null, 2));

    console.log("🎉 Full data sync completed successfully!");

  } catch (error) {
    console.error("❌ Data sync failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  syncAllData()
    .then(() => {
      console.log("✅ Sync script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Sync script failed:", error);
      process.exit(1);
    });
}

export { syncAllData, syncProducts, syncCategories, syncColors, syncCapacities, syncCustomers };