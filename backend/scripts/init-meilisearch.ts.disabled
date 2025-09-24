/**
 * Script to initialize Meilisearch indexes and test connection
 */
import { meilisearchService } from "../src/services/meilisearch.service";

async function initializeMeilisearch() {
  console.log("🚀 Starting Meilisearch initialization...");

  try {
    // Test connection
    console.log("🔍 Testing Meilisearch connection...");
    const isHealthy = await meilisearchService.isHealthy();

    if (!isHealthy) {
      throw new Error("Meilisearch is not healthy. Please check if the service is running.");
    }

    console.log("✅ Meilisearch connection successful!");

    // Initialize indexes
    await meilisearchService.initializeIndexes();

    // Get stats
    console.log("📊 Getting index statistics...");
    const stats = await meilisearchService.getIndexStats();
    console.log("Index Stats:", JSON.stringify(stats, null, 2));

    console.log("🎉 Meilisearch initialization completed successfully!");

  } catch (error) {
    console.error("❌ Meilisearch initialization failed:", error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  initializeMeilisearch()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { initializeMeilisearch };