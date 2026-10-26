"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_products_pinned_at ON products (pinned_at) WHERE pinned_at IS NOT NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_pinned_at`);
    await queryInterface.sequelize.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS pinned_at`
    );
  },
};
