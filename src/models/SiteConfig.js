const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SiteConfig = sequelize.define(
    'SiteConfig',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, defaultValue: 1 },
      linkedinUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'linkedin_url' },
      instagramUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'instagram_url' },
      emailContact: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'email_contact',
        validate: {
          isEmailIfPresent(value) {
            if (value == null || value === '') return;
            if (!/.+@.+\..+/.test(value)) throw new Error('emailContact must be a valid email');
          },
        },
      },
      metaTitle: { type: DataTypes.STRING(255), allowNull: true, field: 'meta_title' },
      metaDescription: { type: DataTypes.STRING(500), allowNull: true, field: 'meta_description' },
      egPhone: { type: DataTypes.STRING(50), allowNull: true, field: 'eg_phone' },
      egWhatsapp: { type: DataTypes.STRING(50), allowNull: true, field: 'eg_whatsapp' },
      egOffice: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'Cairo, Egypt', field: 'eg_office' },
      egHours: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Sun–Thu, 9am–6pm EET',
        field: 'eg_hours',
      },
      egCtaSubtext: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'Serving Egypt',
        field: 'eg_cta_subtext',
      },
      egCalLink: { type: DataTypes.STRING(255), allowNull: true, field: 'eg_cal_link' },
      ksaPhone: { type: DataTypes.STRING(50), allowNull: true, field: 'ksa_phone' },
      ksaWhatsapp: { type: DataTypes.STRING(50), allowNull: true, field: 'ksa_whatsapp' },
      ksaOffice: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'Riyadh, KSA', field: 'ksa_office' },
      ksaHours: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Sun–Thu, 9am–6pm AST',
        field: 'ksa_hours',
      },
      ksaCtaSubtext: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'Serving KSA',
        field: 'ksa_cta_subtext',
      },
      ksaCalLink: { type: DataTypes.STRING(255), allowNull: true, field: 'ksa_cal_link' },
    },
    {
      tableName: 'site_config',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return SiteConfig;
};
