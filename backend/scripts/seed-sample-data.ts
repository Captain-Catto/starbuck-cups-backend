import { PrismaClient } from "../src/generated/prisma";
import { generateVietnameseSlug } from "../src/utils/vietnamese-slug";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedSampleData() {
  try {
    // try {
    //   // Check if admin already exists
    //   const existingAdmin = await prisma.adminUser.findUnique({
    //     where: { email: "admin@gmail.com" },
    //   });

    //   if (existingAdmin) {
    //     console.log("Admin user already exists with email: admin@gmail.com");
    //     return;
    //   }

    //   // Hash password
    //   const hashedPassword = await bcrypt.hash("admin123", 12);

    //   // Create admin user
    //   const admin = await prisma.adminUser.create({
    //     data: {
    //       username: "admin",
    //       email: "admin@gmail.com",
    //       passwordHash: hashedPassword,
    //       role: "SUPER_ADMIN",
    //       isActive: true,
    //     },
    //   });

    //   console.log("Admin user created successfully:");
    //   console.log("Email: admin@gmail.com");
    //   console.log("Password: admin123");
    //   console.log("Role: ADMIN");
    //   console.log("User ID:", admin.id);
    // } catch (error) {
    //   console.error("Error creating admin user:", error);
    // }

    // Get or create admin user
    let admin = await prisma.adminUser.findUnique({
      where: { email: "admin@gmail.com" },
    });

    if (!admin) {
      console.log("No admin user found. Please run create-admin.ts first.");
      return;
    }

    console.log("🌱 Starting sample data seeding...");

    // Create 4 color groups as specified
    const colorsData = [
      { name: "Trắng, kem", hexCode: "#FFFFFF" },
      { name: "Đen, xám, đồng", hexCode: "#000000" },
      { name: "Hồng, tím", hexCode: "#EC4899" },
      { name: "Xanh, xanh lá, xanh dương, mint", hexCode: "#16A34A" },
    ];

    console.log("\n📝 Creating colors...");
    for (const colorData of colorsData) {
      const existingColor = await prisma.color.findUnique({
        where: { slug: generateVietnameseSlug(colorData.name) },
      });

      if (!existingColor) {
        const color = await prisma.color.create({
          data: {
            name: colorData.name,
            slug: generateVietnameseSlug(colorData.name),
            hexCode: colorData.hexCode,
            createdByAdminId: admin.id,
          },
        });
        console.log(`✓ Created color: ${color.name} (${color.hexCode})`);
      } else {
        console.log(`- Color already exists: ${colorData.name}`);
      }
    }

    // Create 5 capacities
    const capacitiesData = [
      { name: "354ml", volumeMl: 354 },
      { name: "473ml", volumeMl: 473 },
      { name: "591ml", volumeMl: 591 },
      { name: "710ml", volumeMl: 710 },
      { name: "887ml", volumeMl: 887 },
    ];

    console.log("\n🥤 Creating capacities...");
    for (const capacityData of capacitiesData) {
      const existingCapacity = await prisma.capacity.findUnique({
        where: { slug: generateVietnameseSlug(capacityData.name) },
      });

      if (!existingCapacity) {
        const capacity = await prisma.capacity.create({
          data: {
            name: capacityData.name,
            slug: generateVietnameseSlug(capacityData.name),
            volumeMl: capacityData.volumeMl,
            createdByAdminId: admin.id,
          },
        });
        console.log(
          `✓ Created capacity: ${capacity.name} (${capacity.volumeMl}ml)`
        );
      } else {
        console.log(`- Capacity already exists: ${capacityData.name}`);
      }
    }

    // Create Vietnamese categories
    const categoriesData = [
      {
        name: "Ly Đá",
        description: "Ly đá Starbucks chất lượng cao, phù hợp cho đồ uống lạnh",
      },
      {
        name: "Ly Gai – Cold Cup",
        description: "Ly gai và cold cup cho trải nghiệm thưởng thức hoàn hảo",
      },
      {
        name: "Bình Giữ Nhiệt",
        description: "Bình giữ nhiệt chất lượng cao, giữ nhiệt lâu dài",
      },
      {
        name: "Stanley",
        description: "Dòng sản phẩm Stanley chính hãng, bền bỉ và thời trang",
      },
      {
        name: "Ly Giữ Nhiệt",
        description: "Ly giữ nhiệt Starbucks, hoàn hảo cho đồ uống nóng",
      },
      {
        name: "Ví, Túi, Balo…",
        description:
          "Phụ kiện thời trang: ví, túi, balo và các món đồ tiện ích",
      },
      {
        name: "Phụ Kiện (Toppers, Móc Khoá, Sổ Tay…)",
        description:
          "Các phụ kiện nhỏ xinh: toppers, móc khoá, sổ tay và nhiều hơn nữa",
      },
      {
        name: "Gấu Bông",
        description: "Gấu bông Starbucks dễ thương, quà tặng hoàn hảo",
      },
      {
        name: "Ly Sứ, Thủy Tinh",
        description: "Ly sứ và thủy tinh cao cấp, sang trọng và tinh tế",
      },
    ];

    console.log("\n📂 Creating categories...");
    for (const categoryData of categoriesData) {
      const existingCategory = await prisma.category.findUnique({
        where: { slug: generateVietnameseSlug(categoryData.name) },
      });

      if (!existingCategory) {
        const category = await prisma.category.create({
          data: {
            name: categoryData.name,
            slug: generateVietnameseSlug(categoryData.name),
            description: categoryData.description,
            createdByAdminId: admin.id,
          },
        });
        console.log(`✓ Created category: ${category.name}`);
      } else {
        console.log(`- Category already exists: ${categoryData.name}`);
      }
    }

    console.log("\n✅ Sample data seeding completed!");
    console.log(`📊 Summary:`);
    console.log(`   - ${colorsData.length} colors`);
    console.log(`   - ${capacitiesData.length} capacities`);
    console.log(`   - ${categoriesData.length} categories`);
  } catch (error) {
    console.error("❌ Error seeding sample data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedSampleData();
