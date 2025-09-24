-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_colors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id")
);

-- Migrate existing data: copy current category and color relationships to junction tables
INSERT INTO "product_categories" ("product_id", "category_id", "created_at")
SELECT "id", "category_id", "created_at" FROM "products"
WHERE "category_id" IS NOT NULL;

INSERT INTO "product_colors" ("product_id", "color_id", "created_at")
SELECT "id", "color_id", "created_at" FROM "products"
WHERE "color_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_product_id_category_id_key" ON "product_categories"("product_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_colors_product_id_color_id_key" ON "product_colors"("product_id", "color_id");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_color_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "category_id",
DROP COLUMN "color_id";