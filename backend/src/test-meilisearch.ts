/**
 * Test script to verify MeiliSearch data structure
 */
import { meilisearchService } from "./services/meilisearch.service";

async function testMeiliSearchStructure() {
  try {
    console.log("🔍 Testing MeiliSearch data structure...");

    // Test search with a Vietnamese query
    const result = await meilisearchService.searchProducts("ly giữ nhiệt", {
      limit: 1,
      offset: 0,
      filters: ["isActive = true"],
    });

    console.log("📊 Search result structure:");
    console.log("Total hits:", result.estimatedTotalHits);
    console.log("Number of results:", result.hits.length);

    if (result.hits.length > 0) {
      console.log("📋 First result structure:");
      console.log(JSON.stringify(result.hits[0], null, 2));
    } else {
      console.log("❌ No results found");
    }
  } catch (error) {
    console.error("❌ Error testing MeiliSearch:", error);
  }
}

// Run the test
testMeiliSearchStructure()
  .then(() => {
    console.log("✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });
