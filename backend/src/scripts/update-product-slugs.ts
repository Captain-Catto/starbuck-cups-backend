import { logger } from "@/utils/logger";
/**
 * One-time migration script: update all product slugs to name-only format.
 *
 * Old format: <name>-<color>-<capacity>  (very long)
 * New format: <name> only
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register src/scripts/update-product-slugs.ts
 *
 * Output:
 *   - Console log of every old → new slug change
 *   - A JSON file `slug-redirects.json` in the project root with the mapping,
 *     ready to paste into Next.js next.config.ts redirects.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initializeDatabase, cleanupDatabase } from "../config/database-init";
import { Product } from "../models";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

dotenv.config();

interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

async function updateProductSlugs(): Promise<void> {
  logger.info("🔄 Starting product slug migration...\n");

  await initializeDatabase();

  const products = await Product.findAll({
    where: { isDeleted: false },
    attributes: ["id", "name", "slug"],
    order: [["createdAt", "ASC"]],
  });

  logger.info(`📦 Found ${products.length} products\n`);

  // Build new slugs and detect conflicts before writing anything
  const slugMap = new Map<string, string>(); // newSlug → productId (first seen wins)
  const plan: Array<{
    id: string;
    name: string;
    oldSlug: string;
    newSlug: string;
    finalSlug: string;
    conflict: boolean;
  }> = [];

  for (const product of products as any[]) {
    const baseSlug = generateVietnameseSlug(product.name);
    let finalSlug = baseSlug;
    let suffix = 2;
    let conflict = false;

    // If slug already used by another product, append numeric suffix
    while (slugMap.has(finalSlug)) {
      finalSlug = `${baseSlug}-${suffix}`;
      suffix++;
      conflict = true;
    }

    slugMap.set(finalSlug, product.id);

    plan.push({
      id: product.id,
      name: product.name,
      oldSlug: product.slug,
      newSlug: baseSlug,
      finalSlug,
      conflict,
    });
  }

  // Print plan
  const changes = plan.filter((p) => p.oldSlug !== p.finalSlug);
  const unchanged = plan.filter((p) => p.oldSlug === p.finalSlug);
  const conflicts = plan.filter((p) => p.conflict);

  logger.info(`✅ No change needed: ${unchanged.length} products`);
  logger.info(`📝 Will update: ${changes.length} products`);
  if (conflicts.length > 0) {
    logger.info(`⚠️  Conflicts resolved with suffix: ${conflicts.length} products`);
  }
  logger.info("");

  if (changes.length === 0) {
    logger.info("Nothing to do. All slugs are already in the new format.");
    return;
  }

  // Print each change
  logger.info("Changes:");
  for (const entry of changes) {
    const marker = entry.conflict ? " ⚠️  (conflict → suffix added)" : "";
    logger.info(`  [${entry.id}] "${entry.name}"`);
    logger.info(`    OLD: ${entry.oldSlug}`);
    logger.info(`    NEW: ${entry.finalSlug}${marker}`);
    logger.info("");
  }

  // Apply updates
  logger.info("💾 Applying updates to database...");
  let updated = 0;
  let failed = 0;

  for (const entry of changes) {
    try {
      await Product.update(
        { slug: entry.finalSlug },
        { where: { id: entry.id } }
      );
      updated++;
    } catch (err: any) {
      logger.error(`  ❌ Failed to update [${entry.id}] ${entry.name}: ${err.message}`);
      failed++;
    }
  }

  logger.info(`\n✅ Updated: ${updated} | ❌ Failed: ${failed}\n`);

  // Write redirect mapping JSON for Next.js
  const redirects: RedirectEntry[] = changes
    .filter((e) => e.oldSlug !== e.finalSlug)
    .map((e) => ({
      source: `/products/${e.oldSlug}`,
      destination: `/products/${e.finalSlug}`,
      permanent: true,
    }));

  // Also add locale-prefixed variants
  const localeRedirects: RedirectEntry[] = [];
  for (const r of redirects) {
    localeRedirects.push({ source: `/en${r.source}`, destination: `/en${r.destination}`, permanent: true });
    localeRedirects.push({ source: `/zh${r.source}`, destination: `/zh${r.destination}`, permanent: true });
  }

  const allRedirects = [...redirects, ...localeRedirects];

  const outputPath = path.resolve(__dirname, "../../../../slug-redirects.json");
  fs.writeFileSync(outputPath, JSON.stringify(allRedirects, null, 2), "utf-8");

  logger.info(`📄 Redirect mapping saved to: ${outputPath}`);
  logger.info(`   ${allRedirects.length} redirect rules (${redirects.length} vi + ${localeRedirects.length} en/zh)\n`);
  logger.info("Next step: paste the contents of slug-redirects.json into");
  logger.info("  next.config.ts → async redirects() { return [...] }");
}

updateProductSlugs()
  .then(async () => {
    await cleanupDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error("❌ Migration failed:", error);
    await cleanupDatabase();
    process.exit(1);
  });
