-- AlterTable
ALTER TABLE "public"."customer_addresses" ADD COLUMN     "ward" VARCHAR(100);

-- AlterTable
ALTER TABLE "public"."product_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."product_colors" ALTER COLUMN "id" DROP DEFAULT;
