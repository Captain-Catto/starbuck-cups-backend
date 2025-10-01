"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("promotional_banners", "highlight_color", {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: "highlight_text",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("promotional_banners", "highlight_color");
  },
};
