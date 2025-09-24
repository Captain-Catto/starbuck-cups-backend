const { PrismaClient } = require("./src/generated/prisma");

const prisma = new PrismaClient();

async function checkSlugs() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        isDeleted: true,
      },
      where: {
        slug: {
          contains: "ly-su-thuy-tinh",
        },
      },
    });

    console.log("Products with ly-su-thuy-tinh in slug:");
    products.forEach((p) => {
      console.log(`- Slug: '${p.slug}'`);
      console.log(`  Name: ${p.name}`);
      console.log(`  Active: ${p.isActive}`);
      console.log(`  Deleted: ${p.isDeleted}`);
      console.log("---");
    });

    // Also check all products
    const allProducts = await prisma.product.findMany({
      select: {
        slug: true,
        name: true,
      },
      take: 5,
    });

    console.log("\nFirst 5 products:");
    allProducts.forEach((p) => {
      console.log(`- ${p.slug} -> ${p.name}`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSlugs();
