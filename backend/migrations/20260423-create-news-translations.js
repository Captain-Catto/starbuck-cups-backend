"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS news_translations (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        news_id UUID NOT NULL REFERENCES news(id) ON UPDATE CASCADE ON DELETE CASCADE,
        locale VARCHAR(5) NOT NULL,
        title VARCHAR(300) NOT NULL,
        summary TEXT,
        content TEXT,
        meta_title VARCHAR(300),
        meta_description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_news_translations_news_locale
      ON news_translations(news_id, locale);
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("news_translations");
  },
};
