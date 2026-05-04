'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('logos', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      type: { type: Sequelize.ENUM('client', 'partner'), allowNull: false },
      image: { type: Sequelize.STRING(500), allowNull: true },
      public_id: { type: Sequelize.STRING(500), allowNull: true },
      url: { type: Sequelize.STRING(500), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('logos', ['type', 'sort_order'], { name: 'idx_logos_type_sort' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('logos');
  },
};
