const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkProducts() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true,
        createdAt: true
      }
    });

    console.log(`Found ${products.length} products:`);
    products.forEach(p => {
      console.log(`- ${p.name}: ${p.images.length} images`);
      if (p.images.length > 0) {
        p.images.forEach((img, i) => console.log(`  [${i+1}] ${img}`));
      }
    });

    if (products.length === 0) {
      console.log('No products found in database. Run seeding first.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();