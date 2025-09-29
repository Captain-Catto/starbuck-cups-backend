'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('order_items', 'product_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('order_items', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });

    console.log('✅ Added product_snapshot and updated_at fields to order_items table');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('order_items', 'product_snapshot');
    await queryInterface.removeColumn('order_items', 'updated_at');
  }
};
