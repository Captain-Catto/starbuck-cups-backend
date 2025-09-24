-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('CUSTOM', 'PRODUCT');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ConsultationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."admin_users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "public"."AdminRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL,
    "messenger_id" VARCHAR(100),
    "zalo_id" VARCHAR(100),
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_admin_id" UUID NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "address_line" VARCHAR(500) NOT NULL,
    "district" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."colors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "hex_code" VARCHAR(7) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_admin_id" UUID NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."capacities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "volume_ml" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_admin_id" UUID NOT NULL,

    CONSTRAINT "capacities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_admin_id" UUID NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "capacity_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB NOT NULL,
    "product_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_type" "public"."OrderType" NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "is_free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "custom_description" TEXT,
    "delivery_address_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "product_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultations" (
    "id" UUID NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(50) NOT NULL,
    "address" TEXT NOT NULL,
    "total_items" INTEGER NOT NULL,
    "status" "public"."ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultation_items" (
    "id" UUID NOT NULL,
    "consultation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "color" VARCHAR(100) NOT NULL,
    "capacity" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "public"."admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "public"."admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_messenger_id_key" ON "public"."customers"("messenger_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_zalo_id_key" ON "public"."customers"("zalo_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "public"."products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "public"."orders"("order_number");

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."colors" ADD CONSTRAINT "colors_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."capacities" ADD CONSTRAINT "capacities_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_capacity_id_fkey" FOREIGN KEY ("capacity_id") REFERENCES "public"."capacities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_deleted_by_admin_id_fkey" FOREIGN KEY ("deleted_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consultation_items" ADD CONSTRAINT "consultation_items_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consultation_items" ADD CONSTRAINT "consultation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
