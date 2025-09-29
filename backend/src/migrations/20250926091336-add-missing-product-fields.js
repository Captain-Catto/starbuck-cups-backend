'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove the old price column and add missing fields
    await queryInterface.removeColumn('products', 'price');
    await queryInterface.removeColumn('products', 'is_featured');

    // Add missing fields from Product-old structure
    await queryInterface.addColumn('products', 'product_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'is_deleted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('products', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'deleted_by_admin_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'admin_users',
        key: 'id'
      }
    });

    await queryInterface.addColumn('products', 'unit_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });

    console.log('✅ Missing Product fields added successfully!');
  },

  async down (queryInterface, Sequelize) {
    // Revert all changes
    await queryInterface.removeColumn('products', 'unit_price');
    await queryInterface.removeColumn('products', 'deleted_by_admin_id');
    await queryInterface.removeColumn('products', 'deleted_at');
    await queryInterface.removeColumn('products', 'is_deleted');
    await queryInterface.removeColumn('products', 'product_url');

    // Add back old columns
    await queryInterface.addColumn('products', 'price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('products', 'is_featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
};
