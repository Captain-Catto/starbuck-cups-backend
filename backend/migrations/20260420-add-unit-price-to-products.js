"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Use raw SQL with IF NOT EXISTS to safely add column if missing
    await queryInterface.sequelize.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) NOT NULL DEFAULT 0`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS unit_price`
    );
  },
};
