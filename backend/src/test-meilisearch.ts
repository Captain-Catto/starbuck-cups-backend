import { logger } from "@/utils/logger";
/**
 * Test script to verify MeiliSearch data structure
 */
import { meilisearchService } from "./services/meilisearch.service";

async function testMeiliSearchStructure() {
  try {
    logger.info("🔍 Testing MeiliSearch data structure...");

    // Test search with a Vietnamese query
    const result = await meilisearchService.searchProducts("ly giữ nhiệt", {
      limit: 1,
      offset: 0,
      filters: ["isActive = true"],
    });

    logger.info("📊 Search result structure:");
    logger.info("Total hits:", result.estimatedTotalHits);
    logger.info("Number of results:", result.hits.length);

    if (result.hits.length > 0) {
      logger.info("📋 First result structure:");
      logger.info(JSON.stringify(result.hits[0], null, 2));
    } else {
      logger.info("❌ No results found");
    }
  } catch (error) {
    logger.error("❌ Error testing MeiliSearch:", error);
  }
}

// Run the test
testMeiliSearchStructure()
  .then(() => {
    logger.info("✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("💥 Test failed:", error);
    process.exit(1);
  });
