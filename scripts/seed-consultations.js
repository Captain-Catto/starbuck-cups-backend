const { PrismaClient } = require("../backend/src/generated/prisma");

const prisma = new PrismaClient();

const sampleConsultations = [
  {
    customerName: "Nguyễn Văn An",
    phoneNumber: "0901234567",
    address: "123 Nguyễn Văn Cừ, Quận 5, TP.HCM",
    totalItems: 2,
    status: "PENDING",
    notes: null,
    consultationItems: [
      {
        productName: "Ly sứ trắng cổ điển",
        quantity: 2,
        color: "Trắng",
        capacity: "350ml",
        category: "Ly cà phê",
      },
      {
        productName: "Bình giữ nhiệt inox",
        quantity: 1,
        color: "Đen",
        capacity: "500ml",
        category: "Bình du lịch",
      },
    ],
  },
  {
    customerName: "Trần Thị Bình",
    phoneNumber: "0987654321",
    address: "456 Lê Văn Sỹ, Quận 3, TP.HCM",
    totalItems: 3,
    status: "IN_PROGRESS",
    notes: "Khách hàng muốn tư vấn về ly cà phê phù hợp để làm quà",
    consultationItems: [
      {
        productName: "Set ly cà phê cao cấp",
        quantity: 1,
        color: "Xanh navy",
        capacity: "250ml",
        category: "Ly cà phê",
      },
      {
        productName: "Ly thủy tinh trong suốt",
        quantity: 2,
        color: "Trong suốt",
        capacity: "300ml",
        category: "Ly thủy tinh",
      },
    ],
  },
  {
    customerName: "Lê Minh Cường",
    phoneNumber: "0912345678",
    address: "789 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM",
    totalItems: 1,
    status: "RESOLVED",
    notes: "Đã tư vấn xong, khách hàng hài lòng với sản phẩm",
    consultationItems: [
      {
        productName: "Bình nước thể thao",
        quantity: 3,
        color: "Xanh dương",
        capacity: "750ml",
        category: "Bình nước",
      },
    ],
  },
  {
    customerName: "Phạm Thị Diệu",
    phoneNumber: "0938765432",
    address: "321 Pasteur, Quận 1, TP.HCM",
    totalItems: 4,
    status: "PENDING",
    notes: null,
    consultationItems: [
      {
        productName: "Cốc sứ hoa văn",
        quantity: 2,
        color: "Hồng",
        capacity: "280ml",
        category: "Cốc trà",
      },
      {
        productName: "Ly thuỷ tinh chịu nhiệt",
        quantity: 2,
        color: "Trong suốt",
        capacity: "400ml",
        category: "Ly thủy tinh",
      },
    ],
  },
  {
    customerName: "Hoàng Văn Em",
    phoneNumber: "0965432109",
    address: "654 Cách Mạng Tháng 8, Quận 10, TP.HCM",
    totalItems: 2,
    status: "IN_PROGRESS",
    notes: "Khách hàng cần tư vấn cho quán cafe mới mở",
    consultationItems: [
      {
        productName: "Ly cà phê espresso",
        quantity: 10,
        color: "Đen",
        capacity: "60ml",
        category: "Ly cà phê",
      },
      {
        productName: "Ly cappuccino",
        quantity: 10,
        color: "Trắng",
        capacity: "180ml",
        category: "Ly cà phê",
      },
    ],
  },
  {
    customerName: "Vũ Thị Phương",
    phoneNumber: "0923456789",
    address: "147 Võ Thị Sáu, Quận 3, TP.HCM",
    totalItems: 1,
    status: "CLOSED",
    notes: "Khách hàng đã quyết định không mua",
    consultationItems: [
      {
        productName: "Bộ ấm trà gốm sứ",
        quantity: 1,
        color: "Xanh lá",
        capacity: "800ml",
        category: "Ấm trà",
      },
    ],
  },
  {
    customerName: "Đỗ Minh Giang",
    phoneNumber: "0934567890",
    address: "258 Nguyễn Đình Chiểu, Quận Phú Nhuận, TP.HCM",
    totalItems: 3,
    status: "RESOLVED",
    notes: "Tư vấn thành công, khách hàng đã đặt hàng",
    consultationItems: [
      {
        productName: "Ly cocktail pha lê",
        quantity: 4,
        color: "Trong suốt",
        capacity: "350ml",
        category: "Ly cocktail",
      },
      {
        productName: "Ly whisky vuông",
        quantity: 4,
        color: "Trong suốt",
        capacity: "300ml",
        category: "Ly rượu",
      },
      {
        productName: "Ly champagne flute",
        quantity: 6,
        color: "Trong suốt",
        capacity: "200ml",
        category: "Ly rượu vang",
      },
    ],
  },
  {
    customerName: "Bùi Thị Hạnh",
    phoneNumber: "0945678901",
    address: "369 Lê Hồng Phong, Quận 5, TP.HCM",
    totalItems: 2,
    status: "PENDING",
    notes: null,
    consultationItems: [
      {
        productName: "Ly nước hoa quả",
        quantity: 6,
        color: "Nhiều màu",
        capacity: "450ml",
        category: "Ly nước",
      },
      {
        productName: "Bình đựng nước có vòi",
        quantity: 1,
        color: "Trắng",
        capacity: "2L",
        category: "Bình nước",
      },
    ],
  },
  {
    customerName: "Ngô Văn Khôi",
    phoneNumber: "0956789012",
    address: "741 Sư Vạn Hạnh, Quận 10, TP.HCM",
    totalItems: 1,
    status: "IN_PROGRESS",
    notes: "Khách hàng muốn cá nhân hóa sản phẩm",
    consultationItems: [
      {
        productName: "Ly cà phê có in tên",
        quantity: 5,
        color: "Đỏ",
        capacity: "400ml",
        category: "Ly cà phê",
      },
    ],
  },
  {
    customerName: "Lý Thị Lan",
    phoneNumber: "0967890123",
    address: "852 Nguyễn Kiệm, Quận Gò Vấp, TP.HCM",
    totalItems: 4,
    status: "RESOLVED",
    notes: "Tư vấn cho sự kiện cưới, khách hàng rất hài lòng",
    consultationItems: [
      {
        productName: "Ly champagne pha lê",
        quantity: 50,
        color: "Trong suốt",
        capacity: "150ml",
        category: "Ly rượu vang",
      },
      {
        productName: "Ly nước có khắc hoa văn",
        quantity: 50,
        color: "Trong suốt",
        capacity: "300ml",
        category: "Ly nước",
      },
      {
        productName: "Bình champagne inox",
        quantity: 2,
        color: "Bạc",
        capacity: "750ml",
        category: "Bình rượu",
      },
      {
        productName: "Khay bày ly pha lê",
        quantity: 5,
        color: "Trong suốt",
        capacity: "N/A",
        category: "Phụ kiện",
      },
    ],
  },
];

async function seedConsultations() {
  console.log("🌱 Bắt đầu seed data consultations...");

  try {
    // Xóa data cũ
    console.log("🗑️ Xóa consultation data cũ...");
    await prisma.consultationItem.deleteMany();
    await prisma.consultation.deleteMany();

    // Lấy một số products có sẵn để tham chiếu
    const products = await prisma.product.findMany({
      take: 20,
      include: {
        color: true,
        capacity: true,
        category: true,
      },
    });

    console.log(`📦 Tìm thấy ${products.length} products để tham chiếu`);

    // Tạo consultations mới
    console.log("✨ Tạo consultation data mới...");

    for (let i = 0; i < sampleConsultations.length; i++) {
      const consultationData = sampleConsultations[i];

      console.log(
        `📋 Tạo consultation ${i + 1}: ${consultationData.customerName}`
      );

      // Tạo consultation
      const consultation = await prisma.consultation.create({
        data: {
          customerName: consultationData.customerName,
          phoneNumber: consultationData.phoneNumber,
          address: consultationData.address,
          totalItems: consultationData.totalItems,
          status: consultationData.status,
          notes: consultationData.notes,
        },
      });

      // Tạo consultation items
      for (let j = 0; j < consultationData.consultationItems.length; j++) {
        const itemData = consultationData.consultationItems[j];

        // Chọn một product ngẫu nhiên để tham chiếu
        const randomProduct =
          products[Math.floor(Math.random() * products.length)];

        await prisma.consultationItem.create({
          data: {
            consultationId: consultation.id,
            productId: randomProduct.id,
            productName: itemData.productName,
            quantity: itemData.quantity,
            color: itemData.color,
            capacity: itemData.capacity,
            category: itemData.category,
          },
        });
      }

      console.log(
        `   ✅ Tạo ${consultationData.consultationItems.length} items cho consultation`
      );
    }

    console.log("🎉 Seed consultations hoàn thành!");

    // Hiển thị thống kê
    const totalConsultations = await prisma.consultation.count();
    const totalItems = await prisma.consultationItem.count();
    const statusStats = await prisma.consultation.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    console.log("\n📊 Thống kê data đã seed:");
    console.log(`   Total consultations: ${totalConsultations}`);
    console.log(`   Total consultation items: ${totalItems}`);
    console.log("   Status distribution:");
    statusStats.forEach((stat) => {
      console.log(`     ${stat.status}: ${stat._count.status}`);
    });
  } catch (error) {
    console.error("❌ Lỗi khi seed consultations:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy seed function
if (require.main === module) {
  seedConsultations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = seedConsultations;
