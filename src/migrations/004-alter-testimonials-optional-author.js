'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('testimonials', 'author', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Fill any NULLs before re-adding the NOT NULL constraint
    await queryInterface.sequelize.query(
      "UPDATE testimonials SET author = '' WHERE author IS NULL"
    );
    await queryInterface.changeColumn('testimonials', 'author', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
