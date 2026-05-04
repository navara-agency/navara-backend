const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CaseStudy = sequelize.define(
    'CaseStudy',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      client: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      title: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      industry: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      market: { type: DataTypes.ENUM('Egypt', 'KSA', 'Both'), allowNull: true },
      services: { type: DataTypes.JSON, allowNull: true },
      challenge: { type: DataTypes.TEXT, allowNull: true },
      outcome: { type: DataTypes.TEXT, allowNull: true },
      coverImage: { type: DataTypes.STRING(500), allowNull: true, field: 'cover_image' },
      coverPublicId: { type: DataTypes.STRING(500), allowNull: true, field: 'cover_public_id' },
      accentColor: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '#FB6107',
        field: 'accent_color',
        validate: { is: /^#[0-9A-Fa-f]{6}$/ },
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
      },
      status: {
        type: DataTypes.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    },
    {
      tableName: 'case_studies',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uq_case_studies_slug', unique: true, fields: ['slug'] },
        { name: 'idx_case_studies_status_sort', fields: ['status', 'sort_order'] },
        { name: 'idx_case_studies_market', fields: ['market'] },
      ],
      validate: {
        coverPaired() {
          const hasUrl = !!this.coverImage;
          const hasId = !!this.coverPublicId;
          if (hasUrl !== hasId) {
            throw new Error('coverImage and coverPublicId must both be present or both null');
          }
        },
      },
    }
  );

  return CaseStudy;
};
