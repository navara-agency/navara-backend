'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('testimonials', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      quote: { type: Sequelize.TEXT, allowNull: false },
      author: { type: Sequelize.STRING(255), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: true },
      company: { type: Sequelize.STRING(255), allowNull: true },
      industry: { type: Sequelize.STRING(255), allowNull: true },
      rating: { type: Sequelize.TINYINT, allowNull: true, defaultValue: 5 },
      photo: { type: Sequelize.STRING(500), allowNull: true },
      photo_public_id: { type: Sequelize.STRING(500), allowNull: true },
      video_url: { type: Sequelize.STRING(500), allowNull: true },
      video_public_id: { type: Sequelize.STRING(500), allowNull: true },
      thumbnail_url: { type: Sequelize.STRING(500), allowNull: true },
      results_badge: { type: Sequelize.STRING(100), allowNull: true },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('testimonials', ['status', 'sort_order'], {
      name: 'idx_testimonials_status_sort',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('testimonials');
  },
};
