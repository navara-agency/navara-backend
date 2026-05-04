const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Logo = sequelize.define(
    'Logo',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      type: { type: DataTypes.ENUM('client', 'partner'), allowNull: false },
      image: { type: DataTypes.STRING(500), allowNull: true },
      publicId: { type: DataTypes.STRING(500), allowNull: true, field: 'public_id' },
      url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrlIfPresent(value) {
            if (value == null || value === '') return;
            // simple URL check — Sequelize isUrl is too strict for our needs
            if (!/^https?:\/\/.+/i.test(value)) throw new Error('url must be http(s)://...');
          },
        },
      },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    },
    {
      tableName: 'logos',
      timestamps: true,
      underscored: true,
      indexes: [{ name: 'idx_logos_type_sort', fields: ['type', 'sort_order'] }],
      validate: {
        publicIdRequiresImage() {
          if (this.publicId && !this.image) throw new Error('publicId requires image url');
        },
      },
    }
  );

  return Logo;
};
