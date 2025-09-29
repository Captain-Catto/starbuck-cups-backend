'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('admin_users', 'refresh_token_hash', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('admin_users', 'refresh_token_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('admin_users', 'refresh_token_hash');
    await queryInterface.removeColumn('admin_users', 'refresh_token_expires_at');
  }
};
