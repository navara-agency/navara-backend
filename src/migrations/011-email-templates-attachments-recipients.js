'use strict';

// Adds per-template attachments + recipient overrides. All new columns are nullable so
// the send pipeline can fall back to existing defaults for any field the admin hasn't set.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('email_templates', 'to_address', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('email_templates', 'cc_address', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('email_templates', 'bcc_address', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('email_templates', 'reply_to_address', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('email_templates', 'from_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('email_templates', 'from_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    // attachments: JSON array of { filename, url, publicId, contentType, sizeBytes }.
    // Stored as JSON so nodemailer can iterate at send time; URLs point at Cloudinary.
    await queryInterface.addColumn('email_templates', 'attachments', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('email_templates', 'to_address');
    await queryInterface.removeColumn('email_templates', 'cc_address');
    await queryInterface.removeColumn('email_templates', 'bcc_address');
    await queryInterface.removeColumn('email_templates', 'reply_to_address');
    await queryInterface.removeColumn('email_templates', 'from_name');
    await queryInterface.removeColumn('email_templates', 'from_email');
    await queryInterface.removeColumn('email_templates', 'attachments');
  },
};
