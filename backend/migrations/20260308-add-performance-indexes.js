"use strict";

const safeAddIndex = async (queryInterface, tableName, fields, options = {}) => {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (error) {
    // Ignore duplicate index errors to keep migration idempotent across environments
    const message = error?.message || "";
    if (
      !message.includes("already exists") &&
      !message.includes("Duplicate key name")
    ) {
      throw error;
    }
  }
};

const safeRemoveIndex = async (queryInterface, tableName, indexName) => {
  try {
    await queryInterface.removeIndex(tableName, indexName);
  } catch (error) {
    const message = error?.message || "";
    if (
      !message.includes("does not exist") &&
      !message.includes("check that it exists")
    ) {
      throw error;
    }
  }
};

module.exports = {
  async up(queryInterface) {
    await safeAddIndex(
      queryInterface,
      "products",
      ["is_active", "is_deleted", "created_at"],
      { name: "idx_products_active_deleted_created" }
    );
    await safeAddIndex(
      queryInterface,
      "products",
      ["is_active", "is_deleted", "stock_quantity"],
      { name: "idx_products_active_deleted_stock" }
    );
    await safeAddIndex(
      queryInterface,
      "products",
      ["is_featured", "is_active", "is_deleted", "created_at"],
      { name: "idx_products_featured_active_deleted_created" }
    );
    await safeAddIndex(queryInterface, "products", ["name"], {
      name: "idx_products_name",
    });

    await safeAddIndex(queryInterface, "orders", ["created_at"], {
      name: "idx_orders_created_at",
    });
    await safeAddIndex(queryInterface, "orders", ["status", "created_at"], {
      name: "idx_orders_status_created_at",
    });
    await safeAddIndex(
      queryInterface,
      "orders",
      ["customer_id", "created_at"],
      { name: "idx_orders_customer_created_at" }
    );
    await safeAddIndex(queryInterface, "orders", ["order_type", "created_at"], {
      name: "idx_orders_type_created_at",
    });

    await safeAddIndex(queryInterface, "order_items", ["order_id"], {
      name: "idx_order_items_order_id",
    });
    await safeAddIndex(queryInterface, "order_items", ["product_id"], {
      name: "idx_order_items_product_id",
    });
    await safeAddIndex(queryInterface, "order_items", ["order_id", "product_id"], {
      name: "idx_order_items_order_product",
    });
  },

  async down(queryInterface) {
    await safeRemoveIndex(
      queryInterface,
      "order_items",
      "idx_order_items_order_product"
    );
    await safeRemoveIndex(
      queryInterface,
      "order_items",
      "idx_order_items_product_id"
    );
    await safeRemoveIndex(
      queryInterface,
      "order_items",
      "idx_order_items_order_id"
    );

    await safeRemoveIndex(queryInterface, "orders", "idx_orders_type_created_at");
    await safeRemoveIndex(
      queryInterface,
      "orders",
      "idx_orders_customer_created_at"
    );
    await safeRemoveIndex(
      queryInterface,
      "orders",
      "idx_orders_status_created_at"
    );
    await safeRemoveIndex(queryInterface, "orders", "idx_orders_created_at");

    await safeRemoveIndex(queryInterface, "products", "idx_products_name");
    await safeRemoveIndex(
      queryInterface,
      "products",
      "idx_products_featured_active_deleted_created"
    );
    await safeRemoveIndex(
      queryInterface,
      "products",
      "idx_products_active_deleted_stock"
    );
    await safeRemoveIndex(
      queryInterface,
      "products",
      "idx_products_active_deleted_created"
    );
  },
};
