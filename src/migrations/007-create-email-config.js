'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_config', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, defaultValue: 1 },
      smtp_host: { type: Sequelize.STRING(255), allowNull: true },
      smtp_port: { type: Sequelize.SMALLINT, allowNull: true, defaultValue: 465 },
      smtp_secure: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      smtp_user: { type: Sequelize.STRING(255), allowNull: true },
      smtp_pass: { type: Sequelize.STRING(500), allowNull: true },
      from_name: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Navara' },
      from_email: { type: Sequelize.STRING(255), allowNull: true },
      notify_email: { type: Sequelize.STRING(255), allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.bulkInsert('email_config', [
      {
        id: 1,
        smtp_host: process.env.SMTP_HOST || null,
        smtp_port: Number(process.env.SMTP_PORT) || 465,
        smtp_secure: process.env.SMTP_SECURE === 'false' ? false : true,
        smtp_user: process.env.SMTP_USER || null,
        smtp_pass: process.env.SMTP_PASS || null,
        from_name: 'Navara',
        from_email: process.env.SMTP_USER || null,
        notify_email: process.env.NOTIFY_EMAIL || null,
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_config');
  },
};
