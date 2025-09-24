/*
  Warnings:

  - You are about to drop the column `images` on the `products` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."customers_messenger_id_key";

-- DropIndex
DROP INDEX "public"."customers_zalo_id_key";

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "images";

-- CreateTable
CREATE TABLE "public"."product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_order_key" ON "public"."product_images"("product_id", "order");

-- AddForeignKey
ALTER TABLE "public"."product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
