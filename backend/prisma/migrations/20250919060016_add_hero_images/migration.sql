/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `capacities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `colors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `capacities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `colors` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."capacities" ADD COLUMN     "slug" VARCHAR(150) NOT NULL;

-- AlterTable
ALTER TABLE "public"."colors" ADD COLUMN     "slug" VARCHAR(150) NOT NULL;

-- CreateTable
CREATE TABLE "public"."hero_images" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "image_url" VARCHAR(1000) NOT NULL,
    "alt_text" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_admin_id" UUID NOT NULL,

    CONSTRAINT "hero_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hero_images_order_key" ON "public"."hero_images"("order");

-- CreateIndex
CREATE UNIQUE INDEX "capacities_slug_key" ON "public"."capacities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "public"."colors"("slug");

-- AddForeignKey
ALTER TABLE "public"."hero_images" ADD CONSTRAINT "hero_images_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
