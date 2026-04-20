import { logger } from "@/utils/logger";
/**
 * Khởi tạo MeiliSearch service khi app startup
 */
import { meilisearchService } from "../services/meilisearch.service";

export async function initializeMeiliSearch(): Promise<boolean> {
  try {
    logger.info("🔍 Initializing MeiliSearch...");

    // Khởi tạo MeiliSearch service
    await meilisearchService.initializeIndexes();

    logger.info("✅ MeiliSearch initialized successfully");

    // Check health
    const isHealthy = await meilisearchService.isHealthy();
    logger.info(
      `🏥 MeiliSearch Health: ${isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`
    );

    // Log stats
    const stats = await meilisearchService.getIndexStats();
    logger.info("📊 MeiliSearch Index Stats:", stats);
    return true;
  } catch (error) {
    logger.error("❌ Failed to initialize MeiliSearch:", error);

    // Don't crash the app if MeiliSearch fails
    // Just log the error and continue
    logger.warn("⚠️ App will continue without search functionality");
    return false;
  }
}

/**
 * Sync initial data to MeiliSearch if indexes are empty
 */
export async function syncInitialData(): Promise<void> {
  try {
    logger.info("🔄 Checking if initial data sync is needed...");

    // Get stats to see if we have data
    const stats = await meilisearchService.getIndexStats();

    logger.info("📊 Current index stats:", stats);

    // If databases are empty, you can uncomment and run the sync script manually:
    logger.info("💡 To sync data to MeiliSearch, run:");
    logger.info("   npm run sync-meilisearch");

    logger.info("ℹ️ MeiliSearch is ready for data sync");
  } catch (error) {
    logger.error("❌ Error checking MeiliSearch sync status:", error);
  }
}
