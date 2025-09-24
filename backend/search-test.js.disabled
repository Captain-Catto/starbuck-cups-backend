/**
 * Quick script to search MeiliSearch for products and see their slugs
 */

const fetch = require("node-fetch");

async function searchProducts() {
  try {
    const response = await fetch(
      "http://localhost:8080/api/search/products?q=ly+gai+cold+cup&limit=5"
    );
    const data = await response.json();

    console.log("🔍 Search results:");

    if (data.success && data.data.hits) {
      data.data.hits.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Slug: ${product.slug}`);
        console.log(`   Active: ${product.isActive}`);
        console.log("");
      });
    } else {
      console.log("No results found");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

searchProducts();
