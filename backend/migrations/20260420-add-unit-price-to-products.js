"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable("products");

    if (!tableDescription.unit_price) {
      await queryInterface.addColumn("products", "unit_price", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable("products");

    if (tableDescription.unit_price) {
      await queryInterface.removeColumn("products", "unit_price");
    }
  },
};
