const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailConfig = sequelize.define(
    'EmailConfig',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, defaultValue: 1 },
      smtpHost: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_host' },
      smtpPort: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        defaultValue: 465,
        field: 'smtp_port',
        validate: { min: 1, max: 65535 },
      },
      smtpSecure: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true, field: 'smtp_secure' },
      smtpUser: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_user' },
      smtpPass: { type: DataTypes.STRING(500), allowNull: true, field: 'smtp_pass' },
      fromName: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Navara', field: 'from_name' },
      fromEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'from_email',
        validate: {
          isEmailIfPresent(value) {
            if (value == null || value === '') return;
            if (!/.+@.+\..+/.test(value)) throw new Error('fromEmail must be a valid email');
          },
        },
      },
      notifyEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'notify_email',
        validate: {
          isEmailIfPresent(value) {
            if (value == null || value === '') return;
            if (!/.+@.+\..+/.test(value)) throw new Error('notifyEmail must be a valid email');
          },
        },
      },
    },
    {
      tableName: 'email_config',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return EmailConfig;
};
