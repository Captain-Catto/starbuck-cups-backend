/*
  Warnings:

  - You are about to drop the column `is_free_shipping` on the `orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."orders" DROP COLUMN "is_free_shipping",
ADD COLUMN     "original_shipping_cost" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shipping_discount" DECIMAL(8,2) NOT NULL DEFAULT 0;
