/**
 * Script to fix Vietnamese product slugs
 * Run with: node fix-product-slugs.js
 */

const { PrismaClient } = require('./src/generated/prisma');

// Vietnamese diacritics mapping
const removeVietnameseDiacritics = (str) => {
  const vietnameseMap = {
    'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd',
    'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ắ': 'A', 'Ằ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ấ': 'A', 'Ầ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'É': 'E', 'È': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ế': 'E', 'Ề': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Í': 'I', 'Ì': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ố': 'O', 'Ồ': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ớ': 'O', 'Ờ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ú': 'U', 'Ù': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ứ': 'U', 'Ừ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
    'Đ': 'D'
  };

  return str.replace(/[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]/g, (match) => vietnameseMap[match] || match);
};

// Generate SEO-friendly slug with Vietnamese support
const generateVietnameseSlug = (name) => {
  return removeVietnameseDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const prisma = new PrismaClient();

async function fixProductSlugs() {
  try {
    console.log('🔧 Starting Vietnamese slug fix...');

    // Get products with their capacity and colors
    const products = await prisma.product.findMany({
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true
          }
        }
      }
    });

    console.log(`📦 Found ${products.length} products to check`);

    let updatedCount = 0;

    for (const product of products) {
      if (product.productColors.length === 0) {
        console.log(`⚠️ Skipping product ${product.name} - no colors found`);
        continue;
      }

      const colorName = product.productColors[0].color.name;
      const capacityName = product.capacity.name;

      // Generate new correct slug
      const newSlug = generateVietnameseSlug(`${product.name} ${colorName} ${capacityName}`);

      if (newSlug !== product.slug) {
        console.log(`🔄 Updating: "${product.name}"`);
        console.log(`   Old slug: ${product.slug}`);
        console.log(`   New slug: ${newSlug}`);

        // Check if new slug already exists
        const existing = await prisma.product.findUnique({
          where: { slug: newSlug }
        });

        if (existing && existing.id !== product.id) {
          // Add counter if slug exists
          let counter = 1;
          let finalSlug = `${newSlug}-${counter}`;
          while (await prisma.product.findUnique({ where: { slug: finalSlug } })) {
            counter++;
            finalSlug = `${newSlug}-${counter}`;
          }

          await prisma.product.update({
            where: { id: product.id },
            data: { slug: finalSlug }
          });

          console.log(`   ✅ Updated to: ${finalSlug} (with counter)`);
        } else {
          await prisma.product.update({
            where: { id: product.id },
            data: { slug: newSlug }
          });

          console.log(`   ✅ Updated to: ${newSlug}`);
        }

        updatedCount++;
      } else {
        console.log(`✅ "${product.name}" - slug already correct`);
      }
    }

    console.log(`\n🎉 Slug fix completed!`);
    console.log(`📊 Updated ${updatedCount} out of ${products.length} products`);

  } catch (error) {
    console.error('❌ Error fixing slugs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixProductSlugs();