/**
 * Meilisearch service for fast and relevant search functionality
 * Handles indexing, searching, and data synchronization
 */
import { MeiliSearch, Index } from "meilisearch";
import dotenv from "dotenv";

dotenv.config();

export interface SearchableProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  stockQuantity: number;
  isActive: boolean;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  colors: Array<{
    id: string;
    name: string;
    slug: string;
    hexCode: string;
  }>;
  capacity: {
    id: string;
    name: string;
    slug: string;
    volumeMl: number;
  };
  images: string[];
  productUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchableCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  parentId?: string;
  parent?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SearchableColor {
  id: string;
  name: string;
  slug: string;
  hexCode: string;
  isActive: boolean;
}

export interface SearchableCapacity {
  id: string;
  name: string;
  slug: string;
  volumeMl: number;
  isActive: boolean;
}

export interface SearchableCustomer {
  id: string;
  fullName: string;
  phone: string;
  messengerId?: string;
  zaloId?: string;
  notes?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: string[];
  facets?: string[];
  sort?: string[];
  highlightPreTag?: string;
  highlightPostTag?: string;
  cropLength?: number;
  showMatchesPosition?: boolean;
}

export interface SearchResult<T> {
  hits: T[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
  facetDistribution?: Record<string, Record<string, number>>;
}

class MeilisearchService {
  private client: MeiliSearch;
  private indexes: {
    products: Index;
    categories: Index;
    colors: Index;
    capacities: Index;
    customers: Index;
  };

  constructor() {
    const host = process.env.MEILISEARCH_HOST || "http://localhost:7700";
    const apiKey = process.env.MEILISEARCH_MASTER_KEY;

    if (!apiKey) {
      throw new Error("MEILISEARCH_MASTER_KEY is required");
    }

    this.client = new MeiliSearch({
      host,
      apiKey,
    });

    // Initialize indexes
    this.indexes = {
      products: this.client.index("products"),
      categories: this.client.index("categories"),
      colors: this.client.index("colors"),
      capacities: this.client.index("capacities"),
      customers: this.client.index("customers"),
    };
  }

  /**
   * Initialize all indexes with proper settings
   */
  async initializeIndexes(): Promise<void> {
    console.log("🔍 Initializing Meilisearch indexes...");

    try {
      // Create indexes first (they will be created if they don't exist)
      const indexNames = [
        "products",
        "categories",
        "colors",
        "capacities",
        "customers",
      ];

      for (const indexName of indexNames) {
        try {
          await this.client.createIndex(indexName, { primaryKey: "id" });
          console.log(`✅ Index '${indexName}' created`);
        } catch (error: any) {
          if (error.cause?.code === "index_already_exists") {
            console.log(`ℹ️  Index '${indexName}' already exists`);
          } else {
            throw error;
          }
        }
      }

      console.log("✅ All indexes ensured to exist");

      // Wait a bit for indexes to be fully created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Products index configuration
      await this.indexes.products.updateSettings({
        searchableAttributes: [
          "name",
          "description",
          "slug",
          "categories.name",
          "colors.name",
          "capacity.name",
        ],
        filterableAttributes: [
          "isActive",
          "categories.id",
          "categories.slug",
          "categories.name",
          "colors.id",
          "colors.slug",
          "colors.name",
          "capacity.id",
          "capacity.slug",
          "capacity.name",
          "stockQuantity",
        ],
        sortableAttributes: ["name", "stockQuantity", "createdAt", "updatedAt"],
        faceting: {
          maxValuesPerFacet: 100,
        },
        pagination: {
          maxTotalHits: 1000,
        },
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: {
            oneTypo: 4,
            twoTypos: 8,
          },
        },
        synonyms: {
          starbucks: ["sbux", "starbuck"],
          ly: ["cốc", "cup"],
          cafe: ["cà phê", "coffee"],
          tra: ["tea", "trà"],
        },
      });

      // Categories index configuration
      await this.indexes.categories.updateSettings({
        searchableAttributes: ["name", "description", "slug"],
        filterableAttributes: ["isActive", "parentId"],
        sortableAttributes: ["name"],
      });

      // Colors index configuration
      await this.indexes.colors.updateSettings({
        searchableAttributes: ["name", "slug"],
        filterableAttributes: ["isActive", "hexCode"],
        sortableAttributes: ["name"],
      });

      // Capacities index configuration
      await this.indexes.capacities.updateSettings({
        searchableAttributes: ["name", "slug"],
        filterableAttributes: ["isActive", "volumeMl"],
        sortableAttributes: ["name", "volumeMl"],
      });

      // Customers index configuration
      await this.indexes.customers.updateSettings({
        searchableAttributes: [
          "fullName",
          "phone",
          "messengerId",
          "zaloId",
          "notes",
        ],
        filterableAttributes: ["messengerId", "zaloId"],
        sortableAttributes: ["fullName"],
      });

      console.log("✅ Meilisearch indexes initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Meilisearch indexes:", error);
      throw error;
    }
  }

  /**
   * Check if Meilisearch is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.status === "available";
    } catch (error) {
      console.error("❌ Meilisearch health check failed:", error);
      return false;
    }
  }

  /**
   * Add or update documents in products index
   */
  async indexProducts(products: SearchableProduct[]): Promise<void> {
    if (products.length === 0) return;

    try {
      console.log(`🔍 Indexing ${products.length} products...`);
      const task = await this.indexes.products.addDocuments(products);
      console.log(`✅ Products indexing task created: ${task.taskUid}`);
    } catch (error) {
      console.error("❌ Error indexing products:", error);
      throw error;
    }
  }

  /**
   * Add or update documents in categories index
   */
  async indexCategories(categories: SearchableCategory[]): Promise<void> {
    if (categories.length === 0) return;

    try {
      console.log(`🔍 Indexing ${categories.length} categories...`);
      const task = await this.indexes.categories.addDocuments(categories);
      console.log(`✅ Categories indexing task created: ${task.taskUid}`);
    } catch (error) {
      console.error("❌ Error indexing categories:", error);
      throw error;
    }
  }

  /**
   * Add or update documents in colors index
   */
  async indexColors(colors: SearchableColor[]): Promise<void> {
    if (colors.length === 0) return;

    try {
      console.log(`🔍 Indexing ${colors.length} colors...`);
      const task = await this.indexes.colors.addDocuments(colors);
      console.log(`✅ Colors indexing task created: ${task.taskUid}`);
    } catch (error) {
      console.error("❌ Error indexing colors:", error);
      throw error;
    }
  }

  /**
   * Add or update documents in capacities index
   */
  async indexCapacities(capacities: SearchableCapacity[]): Promise<void> {
    if (capacities.length === 0) return;

    try {
      console.log(`🔍 Indexing ${capacities.length} capacities...`);
      const task = await this.indexes.capacities.addDocuments(capacities);
      console.log(`✅ Capacities indexing task created: ${task.taskUid}`);
    } catch (error) {
      console.error("❌ Error indexing capacities:", error);
      throw error;
    }
  }

  /**
   * Add or update documents in customers index
   */
  async indexCustomers(customers: SearchableCustomer[]): Promise<void> {
    if (customers.length === 0) return;

    try {
      console.log(`🔍 Indexing ${customers.length} customers...`);
      const task = await this.indexes.customers.addDocuments(customers);
      console.log(`✅ Customers indexing task created: ${task.taskUid}`);
    } catch (error) {
      console.error("❌ Error indexing customers:", error);
      throw error;
    }
  }

  /**
   * Search products with filters and facets
   */
  async searchProducts(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<SearchableProduct>> {
    try {
      const searchOptions: any = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        highlightPreTag: options.highlightPreTag || "<mark>",
        highlightPostTag: options.highlightPostTag || "</mark>",
        cropLength: options.cropLength || 200,
        showMatchesPosition: options.showMatchesPosition || false,
      };

      if (options.filters && options.filters.length > 0) {
        searchOptions.filter = options.filters;
      }

      if (options.facets && options.facets.length > 0) {
        searchOptions.facets = options.facets;
      }

      if (options.sort && options.sort.length > 0) {
        searchOptions.sort = options.sort;
      }

      const result = await this.indexes.products.search(query, searchOptions);

      return {
        hits: result.hits as SearchableProduct[],
        query: result.query,
        processingTimeMs: result.processingTimeMs || 0,
        limit: result.limit || 20,
        offset: result.offset || 0,
        estimatedTotalHits: result.estimatedTotalHits || 0,
        facetDistribution: result.facetDistribution,
      };
    } catch (error) {
      console.error("❌ Error searching products:", error);
      throw error;
    }
  }

  /**
   * Search categories
   */
  async searchCategories(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<SearchableCategory>> {
    try {
      const searchOptions: any = {
        limit: options.limit || 20,
        offset: options.offset || 0,
      };

      if (options.filters && options.filters.length > 0) {
        searchOptions.filter = options.filters;
      }

      const result = await this.indexes.categories.search(query, searchOptions);

      return {
        hits: result.hits as SearchableCategory[],
        query: result.query,
        processingTimeMs: result.processingTimeMs || 0,
        limit: result.limit || 20,
        offset: result.offset || 0,
        estimatedTotalHits: result.estimatedTotalHits || 0,
      };
    } catch (error) {
      console.error("❌ Error searching categories:", error);
      throw error;
    }
  }

  /**
   * Search colors
   */
  async searchColors(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<SearchableColor>> {
    try {
      const searchOptions: any = {
        limit: options.limit || 20,
        offset: options.offset || 0,
      };

      if (options.filters && options.filters.length > 0) {
        searchOptions.filter = options.filters;
      }

      const result = await this.indexes.colors.search(query, searchOptions);

      return {
        hits: result.hits as SearchableColor[],
        query: result.query,
        processingTimeMs: result.processingTimeMs || 0,
        limit: result.limit || 20,
        offset: result.offset || 0,
        estimatedTotalHits: result.estimatedTotalHits || 0,
      };
    } catch (error) {
      console.error("❌ Error searching colors:", error);
      throw error;
    }
  }

  /**
   * Search capacities
   */
  async searchCapacities(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<SearchableCapacity>> {
    try {
      const searchOptions: any = {
        limit: options.limit || 20,
        offset: options.offset || 0,
      };

      if (options.filters && options.filters.length > 0) {
        searchOptions.filter = options.filters;
      }

      const result = await this.indexes.capacities.search(query, searchOptions);

      return {
        hits: result.hits as SearchableCapacity[],
        query: result.query,
        processingTimeMs: result.processingTimeMs || 0,
        limit: result.limit || 20,
        offset: result.offset || 0,
        estimatedTotalHits: result.estimatedTotalHits || 0,
      };
    } catch (error) {
      console.error("❌ Error searching capacities:", error);
      throw error;
    }
  }

  /**
   * Search customers
   */
  async searchCustomers(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<SearchableCustomer>> {
    try {
      const searchOptions: any = {
        limit: options.limit || 20,
        offset: options.offset || 0,
      };

      if (options.filters && options.filters.length > 0) {
        searchOptions.filter = options.filters;
      }

      const result = await this.indexes.customers.search(query, searchOptions);

      return {
        hits: result.hits as SearchableCustomer[],
        query: result.query,
        processingTimeMs: result.processingTimeMs || 0,
        limit: result.limit || 20,
        offset: result.offset || 0,
        estimatedTotalHits: result.estimatedTotalHits || 0,
      };
    } catch (error) {
      console.error("❌ Error searching customers:", error);
      throw error;
    }
  }

  /**
   * Get auto-complete suggestions for products
   */
  async getProductSuggestions(
    query: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const result = await this.indexes.products.search(query, {
        limit,
        attributesToRetrieve: ["name"],
      });

      return result.hits.map((hit: any) => hit.name);
    } catch (error) {
      console.error("❌ Error getting product suggestions:", error);
      throw error;
    }
  }

  /**
   * Delete a document from products index
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.indexes.products.deleteDocument(productId);
      console.log(`✅ Product ${productId} deleted from search index`);
    } catch (error) {
      console.error(
        `❌ Error deleting product ${productId} from index:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a document from categories index
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      await this.indexes.categories.deleteDocument(categoryId);
      console.log(`✅ Category ${categoryId} deleted from search index`);
    } catch (error) {
      console.error(
        `❌ Error deleting category ${categoryId} from index:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a document from colors index
   */
  async deleteColor(colorId: string): Promise<void> {
    try {
      await this.indexes.colors.deleteDocument(colorId);
      console.log(`✅ Color ${colorId} deleted from search index`);
    } catch (error) {
      console.error(`❌ Error deleting color ${colorId} from index:`, error);
      throw error;
    }
  }

  /**
   * Delete a document from capacities index
   */
  async deleteCapacity(capacityId: string): Promise<void> {
    try {
      await this.indexes.capacities.deleteDocument(capacityId);
      console.log(`✅ Capacity ${capacityId} deleted from search index`);
    } catch (error) {
      console.error(
        `❌ Error deleting capacity ${capacityId} from index:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a document from customers index
   */
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.indexes.customers.deleteDocument(customerId);
      console.log(`✅ Customer ${customerId} deleted from search index`);
    } catch (error) {
      console.error(
        `❌ Error deleting customer ${customerId} from index:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clear all documents from all indexes
   */
  async clearAllIndexes(): Promise<void> {
    try {
      console.log("🧹 Clearing all Meilisearch indexes...");

      await Promise.all([
        this.indexes.products.deleteAllDocuments(),
        this.indexes.categories.deleteAllDocuments(),
        this.indexes.colors.deleteAllDocuments(),
        this.indexes.capacities.deleteAllDocuments(),
        this.indexes.customers.deleteAllDocuments(),
      ]);

      console.log("✅ All indexes cleared successfully");
    } catch (error) {
      console.error("❌ Error clearing indexes:", error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<Record<string, any>> {
    try {
      const [
        productsStats,
        categoriesStats,
        colorsStats,
        capacitiesStats,
        customersStats,
      ] = await Promise.all([
        this.indexes.products.getStats(),
        this.indexes.categories.getStats(),
        this.indexes.colors.getStats(),
        this.indexes.capacities.getStats(),
        this.indexes.customers.getStats(),
      ]);

      return {
        products: productsStats,
        categories: categoriesStats,
        colors: colorsStats,
        capacities: capacitiesStats,
        customers: customersStats,
      };
    } catch (error) {
      console.error("❌ Error getting index stats:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const meilisearchService = new MeilisearchService();
