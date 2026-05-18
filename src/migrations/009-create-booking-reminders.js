'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_reminders', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      lead_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      booking_uid: { type: Sequelize.STRING(255), allowNull: true },
      booking_start: { type: Sequelize.DATE, allowNull: false },
      due_at: { type: Sequelize.DATE, allowNull: false },
      timezone: { type: Sequelize.STRING(64), allowNull: true },
      meeting_url: { type: Sequelize.STRING(1024), allowNull: true },
      booking_snapshot: { type: Sequelize.JSON, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      attempts: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('booking_reminders', ['status'], { name: 'idx_booking_reminders_status' });
    await queryInterface.addIndex('booking_reminders', ['due_at'], { name: 'idx_booking_reminders_due_at' });
    await queryInterface.addIndex('booking_reminders', ['lead_id'], { name: 'idx_booking_reminders_lead' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_reminders');
  },
};
