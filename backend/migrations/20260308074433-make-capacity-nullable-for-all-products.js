'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE products ALTER COLUMN capacity_id DROP NOT NULL;'
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE products ALTER COLUMN capacity_id SET NOT NULL;'
    );
  }
};
