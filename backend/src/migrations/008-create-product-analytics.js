'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('product_analytics', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        field: 'id',
      },
      productId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'product_id',
      },
      clickCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'click_count',
      },
      addToCartCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'add_to_cart_count',
      },
      lastClicked: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'last_clicked',
      },
      lastAddedToCart: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'last_added_to_cart',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'created_at',
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'updated_at',
      },
    });

    // Create indexes for performance
    await queryInterface.addIndex('product_analytics', ['product_id'], {
      name: 'idx_product_analytics_product_id',
      unique: true, // One record per product
    });

    await queryInterface.addIndex('product_analytics', ['click_count'], {
      name: 'idx_product_analytics_clicks',
      order: [['click_count', 'DESC']],
    });

    await queryInterface.addIndex('product_analytics', ['add_to_cart_count'], {
      name: 'idx_product_analytics_cart',
      order: [['add_to_cart_count', 'DESC']],
    });

    await queryInterface.addIndex('product_analytics', ['last_clicked'], {
      name: 'idx_product_analytics_last_clicked',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('product_analytics', 'idx_product_analytics_product_id');
    await queryInterface.removeIndex('product_analytics', 'idx_product_analytics_clicks');
    await queryInterface.removeIndex('product_analytics', 'idx_product_analytics_cart');
    await queryInterface.removeIndex('product_analytics', 'idx_product_analytics_last_clicked');

    // Drop table
    await queryInterface.dropTable('product_analytics');
  },
};