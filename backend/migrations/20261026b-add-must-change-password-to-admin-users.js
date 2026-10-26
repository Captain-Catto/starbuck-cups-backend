"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Accounts created by a super admin start with a temporary password the owner must replace
    await queryInterface.sequelize.query(
      `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE admin_users DROP COLUMN IF EXISTS must_change_password`
    );
  },
};
