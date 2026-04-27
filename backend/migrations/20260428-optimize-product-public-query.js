"use strict";

const safeAddIndex = async (queryInterface, tableName, fields, options = {}) => {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (error) {
    const message = error?.message || "";
    if (!message.includes("already exists") && !message.includes("Duplicate key name")) {
      throw error;
    }
  }
};

const safeRemoveIndex = async (queryInterface, tableName, indexName) => {
  try {
    await queryInterface.removeIndex(tableName, indexName);
  } catch (error) {
    const message = error?.message || "";
    if (!message.includes("does not exist") && !message.includes("check that it exists")) {
      throw error;
    }
  }
};

module.exports = {
  async up(queryInterface) {
    // Covering index for the main public product list query:
    //   WHERE is_active=true AND is_deleted=false AND stock_quantity > 0
    //   ORDER BY created_at DESC
    // Columns ordered: equality filters first, range column, sort column last.
    await safeAddIndex(
      queryInterface,
      "products",
      ["is_active", "is_deleted", "stock_quantity", "created_at"],
      { name: "idx_products_public_list" }
    );

    // Index on product_translations(product_id, locale) to speed up locale-filtered JOINs
    await safeAddIndex(
      queryInterface,
      "product_translations",
      ["product_id", "locale"],
      { name: "idx_product_translations_product_locale" }
    );
  },

  async down(queryInterface) {
    await safeRemoveIndex(queryInterface, "product_translations", "idx_product_translations_product_locale");
    await safeRemoveIndex(queryInterface, "products", "idx_products_public_list");
  },
};
