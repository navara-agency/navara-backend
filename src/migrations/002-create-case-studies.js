'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('case_studies', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      client: { type: Sequelize.STRING(255), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      industry: { type: Sequelize.STRING(255), allowNull: false },
      market: { type: Sequelize.ENUM('Egypt', 'KSA', 'Both'), allowNull: true },
      services: { type: Sequelize.JSON, allowNull: true },
      challenge: { type: Sequelize.TEXT, allowNull: true },
      outcome: { type: Sequelize.TEXT, allowNull: true },
      cover_image: { type: Sequelize.STRING(500), allowNull: true },
      cover_public_id: { type: Sequelize.STRING(500), allowNull: true },
      accent_color: { type: Sequelize.STRING(20), allowNull: true, defaultValue: '#FB6107' },
      slug: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('case_studies', ['status', 'sort_order'], {
      name: 'idx_case_studies_status_sort',
    });
    await queryInterface.addIndex('case_studies', ['market'], { name: 'idx_case_studies_market' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('case_studies');
  },
};
