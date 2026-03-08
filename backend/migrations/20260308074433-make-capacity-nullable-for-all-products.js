'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('products', 'capacity_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Note: Reverting this may fail if there are existing products with null capacity_id
    await queryInterface.changeColumn('products', 'capacity_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  }
};
