'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, create the promotional_banners table
    await queryInterface.createTable('promotional_banners', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      highlight_text: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      button_text: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      button_link: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by_admin_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'admin_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
    });

    // Add indexes
    await queryInterface.addIndex('promotional_banners', ['is_active', 'priority']);
    await queryInterface.addIndex('promotional_banners', ['valid_from', 'valid_until']);

    // Get the first admin user to use as creator
    const [adminUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM admin_users LIMIT 1;`
    );

    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found. Skipping promotional banner seed data.');
      return;
    }

    const adminId = adminUsers[0].id;

    // Insert default promotional banner
    await queryInterface.bulkInsert('promotional_banners', [
      {
        id: uuidv4(),
        title: 'Bộ Sưu Tập',
        highlight_text: 'Ly Starbucks',
        description: 'Khám phá bộ sưu tập ly Starbucks đa dạng với nhiều màu sắc và dung tích. Tư vấn miễn phí qua Messenger.',
        button_text: 'Khám Phá Ngay',
        button_link: '/products',
        is_active: true,
        priority: 1,
        valid_from: null,
        valid_until: null,
        created_by_admin_id: adminId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('✅ Promotional banners table created and seeded successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('promotional_banners');
    console.log('✅ Promotional banners table dropped successfully!');
  },
};
