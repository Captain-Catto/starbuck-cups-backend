import { PrismaClient } from "../src/generated/prisma";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: "admin@gmail.com" },
    });

    if (existingAdmin) {
      console.log("Admin user already exists with email: admin@gmail.com");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 12);

    // Create admin user
    const admin = await prisma.adminUser.create({
      data: {
        username: "admin",
        email: "admin@gmail.com",
        passwordHash: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    console.log("Admin user created successfully:");
    console.log("Email: admin@gmail.com");
    console.log("Password: admin123");
    console.log("Role: ADMIN");
    console.log("User ID:", admin.id);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
