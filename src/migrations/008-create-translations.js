'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('translations', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      lang: { type: Sequelize.ENUM('en', 'ar'), allowNull: false, unique: true },
      keys_json: { type: Sequelize.JSON, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('translations', ['lang'], {
      name: 'uq_translations_lang',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('translations');
  },
};
