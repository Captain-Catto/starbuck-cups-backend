import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSlug() {
  try {
    console.log('🔍 Checking for products with slug containing "ly-gai"...');

    // Search for products with similar names that might have that slug
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: "ly gai", mode: "insensitive" } },
          { name: { contains: "cold cup", mode: "insensitive" } },
          { slug: { contains: "ly-gai" } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isDeleted: true,
      },
      take: 10,
    });

    console.log("🔍 Found products with similar names:");
    products.forEach((p: any) => {
      console.log(
        `- ${p.name} → ${p.slug} (active: ${p.isActive}, deleted: ${p.isDeleted})`
      );
    });

    console.log("\n🔍 Looking for exact slug...");
    const exactSlug = await prisma.product.findFirst({
      where: {
        slug: "ly-gai-cold-cup-xanh-xanh-la-xanh-duong-mint-473ml",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (exactSlug) {
      console.log("✅ Found exact slug:", exactSlug);
    } else {
      console.log("❌ Exact slug not found in database");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkSlug();
