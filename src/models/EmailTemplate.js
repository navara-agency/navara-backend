const { DataTypes } = require('sequelize');

// One row per send-able email. The template key identifies which code path renders it;
// admins edit subject + bodyText + bodyHtml from the dashboard. The wrapping HTML layout
// (logo, header, footer) stays in code — admins only edit the inner content.
module.exports = (sequelize) => {
  const EmailTemplate = sequelize.define(
    'EmailTemplate',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      templateKey: {
        type: DataTypes.ENUM('lead_notification', 'booking_confirmation', 'booking_reminder'),
        allowNull: false,
        unique: true,
        field: 'template_key',
      },
      subject: { type: DataTypes.STRING(500), allowNull: false },
      bodyText: { type: DataTypes.TEXT('long'), allowNull: false, field: 'body_text' },
      // null for templates that are plain-text only (lead_notification)
      bodyHtml: { type: DataTypes.TEXT('long'), allowNull: true, field: 'body_html' },
      // Recipient overrides — null = use built-in default for that template. Strings, with
      // {{placeholders}} supported and comma-separated lists allowed for cc/bcc.
      toAddress: { type: DataTypes.STRING(500), allowNull: true, field: 'to_address' },
      ccAddress: { type: DataTypes.STRING(500), allowNull: true, field: 'cc_address' },
      bccAddress: { type: DataTypes.STRING(500), allowNull: true, field: 'bcc_address' },
      replyToAddress: { type: DataTypes.STRING(500), allowNull: true, field: 'reply_to_address' },
      // Sender overrides — null = use EmailConfig.fromName / .fromEmail.
      fromName: { type: DataTypes.STRING(255), allowNull: true, field: 'from_name' },
      fromEmail: { type: DataTypes.STRING(255), allowNull: true, field: 'from_email' },
      // Array of { filename, url, publicId, contentType, sizeBytes }. Nodemailer downloads
      // each at send time and attaches it as `path` (URL).
      attachments: { type: DataTypes.JSON, allowNull: true },
      // Lets admins disable a whole template (e.g. turn off the confirmation entirely) without
      // editing the body. send functions check enabled before rendering.
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      tableName: 'email_templates',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
      underscored: true,
      indexes: [{ name: 'uq_email_templates_key', unique: true, fields: ['template_key'] }],
    }
  );

  return EmailTemplate;
};
