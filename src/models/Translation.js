const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Translation = sequelize.define(
    'Translation',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      lang: {
        type: DataTypes.ENUM('en', 'ar'),
        allowNull: false,
        unique: true,
      },
      keysJson: {
        type: DataTypes.JSON,
        allowNull: false,
        field: 'keys_json',
        validate: {
          isPlainObject(value) {
            if (value == null || typeof value !== 'object' || Array.isArray(value)) {
              throw new Error('keysJson must be a plain (non-array) object');
            }
          },
        },
      },
    },
    {
      tableName: 'translations',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
      underscored: true,
      indexes: [{ name: 'uq_translations_lang', unique: true, fields: ['lang'] }],
    }
  );

  return Translation;
};
