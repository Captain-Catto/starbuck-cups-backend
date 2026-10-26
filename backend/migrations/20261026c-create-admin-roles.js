"use strict";

// Roles become data: admin_roles + admin_role_permissions, and admin_users points at one role.
// The built-in roles and their permissions are seeded by the app on startup (it owns the catalog),
// which also fills admin_users.role_id from the legacy role enum.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        key VARCHAR(30) UNIQUE,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_role_permissions (
        role_id UUID NOT NULL REFERENCES admin_roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
        permission VARCHAR(60) NOT NULL,
        PRIMARY KEY (role_id, permission)
      );
    `);
    await queryInterface.sequelize.query(
      `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES admin_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON admin_users(role_id)`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_admin_users_role_id`);
    await queryInterface.sequelize.query(`ALTER TABLE admin_users DROP COLUMN IF EXISTS role_id`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS admin_role_permissions`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS admin_roles`);
  },
};
