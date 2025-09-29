'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminUserId = (await queryInterface.sequelize.query(
      'SELECT id FROM admin_users LIMIT 1'
    ))[0][0]?.id;

    if (!adminUserId) {
      console.log('❌ No admin user found, skipping seeder');
      return;
    }

    // Create categories
    const categoryIds = {
      cups: uuidv4(),
      mugs: uuidv4(),
      tumblers: uuidv4()
    };

    await queryInterface.bulkInsert('categories', [
      {
        id: categoryIds.cups,
        name: 'Ly Giấy Starbucks',
        slug: 'ly-giay-starbucks',
        description: 'Bộ sưu tập ly giấy Starbucks độc đáo',
        parent_id: null,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: categoryIds.mugs,
        name: 'Cốc Sứ Starbucks',
        slug: 'coc-su-starbucks',
        description: 'Cốc sứ cao cấp với thiết kế Starbucks',
        parent_id: null,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: categoryIds.tumblers,
        name: 'Tumbler Starbucks',
        slug: 'tumbler-starbucks',
        description: 'Tumbler giữ nhiệt thời trang',
        parent_id: null,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Create hero images
    await queryInterface.bulkInsert('hero_images', [
      {
        id: uuidv4(),
        title: 'Bộ Sưu Tập Starbucks 2024',
        image_url: 'https://via.placeholder.com/1200x600/00704A/ffffff?text=Starbucks+Collection+2024',
        link_url: '/products',
        display_order: 1,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Ly Cao Cấp Giới Hạn',
        image_url: 'https://via.placeholder.com/1200x600/1E40AF/ffffff?text=Limited+Edition+Cups',
        link_url: '/products?category=limited',
        display_order: 2,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Categories and hero images created successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('hero_images', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  }
};