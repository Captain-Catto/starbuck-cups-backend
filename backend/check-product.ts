import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkProduct() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: "ly-gai-cold-cup-den-xam-dong-591ml",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (product) {
      console.log("✅ Product found:", product);
    } else {
      console.log(
        "❌ Product not found with slug: ly-gai-cold-cup-den-xam-dong-591ml"
      );

      // Check if any product exists with similar slug
      const similar = await prisma.product.findMany({
        where: {
          slug: {
            contains: "ly-gai",
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isDeleted: true,
        },
        take: 5,
      });

      console.log("🔍 Similar products:", similar);

      // Check total product count
      const totalCount = await prisma.product.count();
      console.log("📊 Total products in database:", totalCount);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkProduct();
