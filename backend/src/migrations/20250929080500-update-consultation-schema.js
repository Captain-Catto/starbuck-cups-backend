'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add email column to consultations table
    await queryInterface.addColumn('consultations', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Remove quantity column from consultation_items table
    await queryInterface.removeColumn('consultation_items', 'quantity');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove email column from consultations table
    await queryInterface.removeColumn('consultations', 'email');

    // Add back quantity column to consultation_items table
    await queryInterface.addColumn('consultation_items', 'quantity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
  }
};