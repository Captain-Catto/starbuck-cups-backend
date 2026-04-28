"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS news (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        slug VARCHAR(300) NOT NULL UNIQUE,
        thumbnail VARCHAR(500),
        status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        published_at TIMESTAMPTZ,
        view_count INTEGER NOT NULL DEFAULT 0,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        deleted_at TIMESTAMPTZ,
        deleted_by_admin_id CHAR(36) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_by_admin_id CHAR(36) NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_news_is_deleted ON news(is_deleted);`);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("news");
  },
};
