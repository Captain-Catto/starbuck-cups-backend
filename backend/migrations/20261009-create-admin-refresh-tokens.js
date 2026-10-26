"use strict";

// One row per logged-in device so several sessions of the same admin can coexist.
// Replaces the single admin_users.refresh_token_hash column, which made every login
// or refresh on one device invalidate the session on all the others.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        admin_user_id CHAR(36) NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        replaced_at TIMESTAMPTZ,
        user_agent VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_refresh_tokens_hash
      ON admin_refresh_tokens(token_hash);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_user
      ON admin_refresh_tokens(admin_user_id);
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("admin_refresh_tokens");
  },
};
