/**
 * Khởi tạo MeiliSearch service khi app startup
 */
import { meilisearchService } from "../services/meilisearch.service";

export async function initializeMeiliSearch(): Promise<void> {
  try {
    console.log("🔍 Initializing MeiliSearch...");

    // Khởi tạo MeiliSearch service
    await meilisearchService.initializeIndexes();

    console.log("✅ MeiliSearch initialized successfully");

    // Check health
    const isHealthy = await meilisearchService.isHealthy();
    console.log(
      `🏥 MeiliSearch Health: ${isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`
    );

    // Log stats
    const stats = await meilisearchService.getIndexStats();
    console.log("📊 MeiliSearch Index Stats:", stats);
  } catch (error) {
    console.error("❌ Failed to initialize MeiliSearch:", error);

    // Don't crash the app if MeiliSearch fails
    // Just log the error and continue
    console.warn("⚠️ App will continue without search functionality");
  }
}

/**
 * Sync initial data to MeiliSearch if indexes are empty
 */
export async function syncInitialData(): Promise<void> {
  try {
    console.log("🔄 Checking if initial data sync is needed...");

    // Get stats to see if we have data
    const stats = await meilisearchService.getIndexStats();

    console.log("📊 Current index stats:", stats);

    // If databases are empty, you can uncomment and run the sync script manually:
    console.log("💡 To sync data to MeiliSearch, run:");
    console.log("   npm run sync-meilisearch");

    console.log("ℹ️ MeiliSearch is ready for data sync");
  } catch (error) {
    console.error("❌ Error checking MeiliSearch sync status:", error);
  }
}
