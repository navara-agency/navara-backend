'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_templates', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      template_key: {
        type: Sequelize.ENUM('lead_notification', 'booking_confirmation', 'booking_reminder'),
        allowNull: false,
        unique: true,
      },
      subject: { type: Sequelize.STRING(500), allowNull: false },
      body_text: { type: Sequelize.TEXT('long'), allowNull: false },
      body_html: { type: Sequelize.TEXT('long'), allowNull: true },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('email_templates', ['template_key'], {
      unique: true,
      name: 'uq_email_templates_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_templates');
  },
};
