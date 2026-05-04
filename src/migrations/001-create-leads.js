'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leads', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      company: { type: Sequelize.STRING(255), allowNull: false },
      market: { type: Sequelize.ENUM('Egypt', 'KSA', 'Other'), allowNull: false },
      industry: { type: Sequelize.STRING(255), allowNull: false },
      goal: { type: Sequelize.STRING(255), allowNull: true },
      services: { type: Sequelize.JSON, allowNull: true },
      budget: { type: Sequelize.STRING(100), allowNull: true },
      phone: { type: Sequelize.STRING(50), allowNull: true },
      email: { type: Sequelize.STRING(255), allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('new', 'reviewed', 'contacted', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      },
      submitted_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      read_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('leads', ['status'], { name: 'idx_leads_status' });
    await queryInterface.addIndex('leads', ['market'], { name: 'idx_leads_market' });
    await queryInterface.addIndex('leads', [{ name: 'submitted_at', order: 'DESC' }], {
      name: 'idx_leads_submitted_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leads');
  },
};
