const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FaqItem = sequelize.define(
    'FaqItem',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      questionEn: { type: DataTypes.TEXT, allowNull: false, field: 'question_en', validate: { notEmpty: true } },
      answerEn: { type: DataTypes.TEXT, allowNull: false, field: 'answer_en', validate: { notEmpty: true } },
      questionAr: { type: DataTypes.TEXT, allowNull: false, field: 'question_ar', validate: { notEmpty: true } },
      answerAr: { type: DataTypes.TEXT, allowNull: false, field: 'answer_ar', validate: { notEmpty: true } },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    },
    {
      tableName: 'faq_items',
      timestamps: true,
      underscored: true,
      indexes: [{ name: 'idx_faq_items_enabled_sort', fields: ['enabled', 'sort_order'] }],
    }
  );

  return FaqItem;
};
