import { PrismaClient } from "../src/generated/prisma";
import { generateVietnameseSlug } from "../src/utils/vietnamese-slug";

const prisma = new PrismaClient();

async function seed200Products() {
  try {
    console.log("🌱 Starting 200 products seeding...");

    // Get admin user
    const admin = await prisma.adminUser.findUnique({
      where: { email: "admin@gmail.com" },
    });

    if (!admin) {
      console.log("❌ No admin user found. Please run create-admin.ts first.");
      return;
    }

    // Get all colors, capacities, and categories
    const colors = await prisma.color.findMany({ where: { isActive: true } });
    const capacities = await prisma.capacity.findMany({
      where: { isActive: true },
    });
    const categories = await prisma.category.findMany({
      where: { isActive: true },
    });

    if (
      colors.length === 0 ||
      capacities.length === 0 ||
      categories.length === 0
    ) {
      console.log(
        "❌ Missing base data. Please run seed-sample-data.ts first."
      );
      return;
    }

    console.log(
      `✓ Found ${colors.length} colors, ${capacities.length} capacities, ${categories.length} categories`
    );

    // Calculate products per category (200 products / 9 categories ≈ 22 products each)
    const totalProducts = 200;
    const productsPerCategory = Math.floor(totalProducts / categories.length);
    const extraProducts = totalProducts % categories.length;

    console.log(
      `📊 Distribution: ${productsPerCategory} products per category, ${extraProducts} extra products`
    );

    const imageBaseUrls = [
      "https://starbucks-shop.s3.ap-southeast-1.amazonaws.com/products/coc-526764567_122192221670365794_9158316000717051551_n.jpg",
      "https://starbucks-shop.s3.ap-southeast-1.amazonaws.com/products/coc-525623582_122192221598365794_4974971925706294880_n.jpg",
    ];

    let totalCreated = 0;
    let productCounter = 1;

    for (const [categoryIndex, category] of categories.entries()) {
      // Some categories get extra products
      const productsForThisCategory =
        productsPerCategory + (categoryIndex < extraProducts ? 1 : 0);

      console.log(
        `\n📂 Creating ${productsForThisCategory} products for category: ${category.name}`
      );

      for (let i = 0; i < productsForThisCategory; i++) {
        // Random color and capacity
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const randomCapacity =
          capacities[Math.floor(Math.random() * capacities.length)];

        // Generate product name: category - color - capacity
        const productName = `${category.name} - ${randomColor.name} - ${randomCapacity.name}`;

        // Generate unique slug
        const baseSlug = generateVietnameseSlug(productName);
        let slug = baseSlug;
        let counter = 1;

        // Check if slug exists and increment if needed
        while (await prisma.product.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Random price between 200,000 and 2,000,000 VND
        const randomPrice =
          Math.floor(Math.random() * (2000000 - 200000 + 1)) + 200000;

        // Random stock between 5 and 50
        const randomStock = Math.floor(Math.random() * (50 - 5 + 1)) + 5;

        // Create product
        const product = await prisma.product.create({
          data: {
            name: productName,
            slug: slug,
            description: `Sản phẩm ${productName} chất lượng cao từ Starbucks. Thiết kế tinh tế và hiện đại, phù hợp cho mọi lứa tuổi.`,
            unitPrice: randomPrice,
            stockQuantity: randomStock,
            capacityId: randomCapacity.id,
            isActive: true,
          },
        });

        // Create product-color relationship
        await prisma.productColor.create({
          data: {
            productId: product.id,
            colorId: randomColor.id,
          },
        });

        // Create product-category relationship
        await prisma.productCategory.create({
          data: {
            productId: product.id,
            categoryId: category.id,
          },
        });

        // Create 10 product images for each product
        for (let imgIndex = 0; imgIndex < 10; imgIndex++) {
          await prisma.productImage.create({
            data: {
              productId: product.id,
              url: imageBaseUrls[
                Math.floor(Math.random() * imageBaseUrls.length)
              ],
              order: imgIndex,
            },
          });
        }

        console.log(`✓ [${productCounter}/200] Created: ${product.name}`);
        console.log(`   - Price: ${product.unitPrice.toLocaleString()}đ`);
        console.log(`   - Stock: ${product.stockQuantity}`);
        console.log(`   - Images: 10`);

        totalCreated++;
        productCounter++;
      }
    }

    // Summary
    const totalProductsInDb = await prisma.product.count();
    const totalImagesInDb = await prisma.productImage.count();

    console.log("\n✅ 200 products seeding completed!");
    console.log(`📊 Final Summary:`);
    console.log(`   - ${totalCreated} new products created`);
    console.log(`   - ${totalProductsInDb} total products in database`);
    console.log(`   - ${totalImagesInDb} total product images`);
    console.log(`   - ${colors.length} colors available`);
    console.log(`   - ${capacities.length} capacities available`);
    console.log(`   - ${categories.length} categories`);

    // Show distribution by category
    console.log("\n📊 Products per category:");
    for (const category of categories) {
      const count = await prisma.product.count({
        where: {
          productCategories: {
            some: {
              categoryId: category.id,
            },
          },
        },
      });
      console.log(`   - ${category.name}: ${count} products`);
    }
  } catch (error) {
    console.error("❌ Error seeding 200 products:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed200Products();
