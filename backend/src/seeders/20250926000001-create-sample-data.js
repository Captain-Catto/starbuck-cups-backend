'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    const adminUserId = uuidv4();
    await queryInterface.bulkInsert('admin_users', [{
      id: adminUserId,
      username: 'admin',
      password_hash: hashedPassword,
      email: 'admin@starbucks.local',
      role: 'SUPER_ADMIN',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Create capacities
    const capacityIds = {
      small: uuidv4(),
      medium: uuidv4(),
      large: uuidv4()
    };

    await queryInterface.bulkInsert('capacities', [
      {
        id: capacityIds.small,
        name: '8oz Small',
        slug: '8oz-small',
        volume_ml: 240,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: capacityIds.medium,
        name: '12oz Medium',
        slug: '12oz-medium',
        volume_ml: 355,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: capacityIds.large,
        name: '16oz Large',
        slug: '16oz-large',
        volume_ml: 473,
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Create colors
    const colorIds = {
      red: uuidv4(),
      green: uuidv4(),
      blue: uuidv4(),
      black: uuidv4(),
      white: uuidv4()
    };

    await queryInterface.bulkInsert('colors', [
      {
        id: colorIds.red,
        name: 'Đỏ Starbucks',
        slug: 'red-starbucks',
        hex_code: '#00704A',
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: colorIds.green,
        name: 'Xanh Starbucks',
        slug: 'green-starbucks',
        hex_code: '#00704A',
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: colorIds.blue,
        name: 'Xanh Dương',
        slug: 'blue',
        hex_code: '#1E40AF',
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: colorIds.black,
        name: 'Đen Classic',
        slug: 'black-classic',
        hex_code: '#000000',
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: colorIds.white,
        name: 'Trắng Pure',
        slug: 'white-pure',
        hex_code: '#FFFFFF',
        is_active: true,
        created_by_admin_id: adminUserId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Sample data created successfully!');
    console.log('🔑 Admin credentials: admin / admin123');
    console.log(`🆔 Admin ID: ${adminUserId}`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('colors', null, {});
    await queryInterface.bulkDelete('capacities', null, {});
    await queryInterface.bulkDelete('admin_users', null, {});
  }
};