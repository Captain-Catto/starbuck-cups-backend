"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("news_translations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      news_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "news", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      locale: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      meta_title: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      meta_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("news_translations", ["news_id", "locale"], {
      unique: true,
      name: "uq_news_translations_news_locale",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("news_translations");
  },
};
