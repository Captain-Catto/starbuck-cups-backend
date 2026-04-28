"use strict";

// Partial indexes: only index rows matching the WHERE clause.
// For a product catalog WHERE is_active=true AND is_deleted=false AND stock_quantity > 0,
// this is ~80% smaller than a full index and PostgreSQL can use it as a covering scan.
module.exports = {
  async up(queryInterface) {
    // Drop old full indexes that are superseded by partial ones
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_products_active_deleted_created;
      DROP INDEX IF EXISTS idx_products_active_deleted_stock;
      DROP INDEX IF EXISTS idx_products_featured_active_deleted_created;
      DROP INDEX IF EXISTS idx_products_public_list;
    `);

    // Partial index for default public product list (ORDER BY created_at DESC)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_visible_created
      ON products(created_at DESC)
      WHERE is_active = true AND is_deleted = false AND stock_quantity > 0;
    `);

    // Partial index for featured-first sort
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_visible_featured
      ON products(is_featured DESC, created_at DESC)
      WHERE is_active = true AND is_deleted = false AND stock_quantity > 0;
    `);

    // Partial index for slug lookups on public products
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_products_slug_unique
      ON products(slug)
      WHERE is_deleted = false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_products_visible_created;
      DROP INDEX IF EXISTS idx_products_visible_featured;
      DROP INDEX IF EXISTS idx_products_slug_unique;
    `);

    // Restore original indexes
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_active_deleted_created
        ON products(is_active, is_deleted, created_at);
      CREATE INDEX IF NOT EXISTS idx_products_active_deleted_stock
        ON products(is_active, is_deleted, stock_quantity);
      CREATE INDEX IF NOT EXISTS idx_products_featured_active_deleted_created
        ON products(is_featured, is_active, is_deleted, created_at);
    `);
  },
};
