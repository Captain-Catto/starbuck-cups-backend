'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('hero_images', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    console.log('✅ Added order column to hero_images table');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('hero_images', 'order');
  }
};
