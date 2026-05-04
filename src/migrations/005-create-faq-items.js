'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('faq_items', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      question_en: { type: Sequelize.TEXT, allowNull: false },
      answer_en: { type: Sequelize.TEXT, allowNull: false },
      question_ar: { type: Sequelize.TEXT, allowNull: false },
      answer_ar: { type: Sequelize.TEXT, allowNull: false },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('faq_items', ['enabled', 'sort_order'], {
      name: 'idx_faq_items_enabled_sort',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('faq_items');
  },
};
