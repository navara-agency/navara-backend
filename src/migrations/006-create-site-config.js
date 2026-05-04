'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('site_config', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, defaultValue: 1 },
      linkedin_url: { type: Sequelize.STRING(500), allowNull: true },
      instagram_url: { type: Sequelize.STRING(500), allowNull: true },
      email_contact: { type: Sequelize.STRING(255), allowNull: true },
      meta_title: { type: Sequelize.STRING(255), allowNull: true },
      meta_description: { type: Sequelize.STRING(500), allowNull: true },
      eg_phone: { type: Sequelize.STRING(50), allowNull: true },
      eg_whatsapp: { type: Sequelize.STRING(50), allowNull: true },
      eg_office: { type: Sequelize.STRING(255), allowNull: true, defaultValue: 'Cairo, Egypt' },
      eg_hours: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Sun–Thu, 9am–6pm EET' },
      eg_cta_subtext: { type: Sequelize.STRING(255), allowNull: true, defaultValue: 'Serving Egypt' },
      eg_cal_link: { type: Sequelize.STRING(255), allowNull: true },
      ksa_phone: { type: Sequelize.STRING(50), allowNull: true },
      ksa_whatsapp: { type: Sequelize.STRING(50), allowNull: true },
      ksa_office: { type: Sequelize.STRING(255), allowNull: true, defaultValue: 'Riyadh, KSA' },
      ksa_hours: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Sun–Thu, 9am–6pm AST' },
      ksa_cta_subtext: { type: Sequelize.STRING(255), allowNull: true, defaultValue: 'Serving KSA' },
      ksa_cal_link: { type: Sequelize.STRING(255), allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Insert singleton row id=1
    await queryInterface.bulkInsert('site_config', [
      {
        id: 1,
        eg_office: 'Cairo, Egypt',
        eg_hours: 'Sun–Thu, 9am–6pm EET',
        eg_cta_subtext: 'Serving Egypt',
        ksa_office: 'Riyadh, KSA',
        ksa_hours: 'Sun–Thu, 9am–6pm AST',
        ksa_cta_subtext: 'Serving KSA',
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('site_config');
  },
};
