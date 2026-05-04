const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Lead = sequelize.define(
    'Lead',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 255] },
      },
      company: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 255] },
      },
      market: {
        type: DataTypes.ENUM('Egypt', 'KSA', 'Other'),
        allowNull: false,
      },
      industry: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true },
      },
      goal: { type: DataTypes.STRING(255), allowNull: true },
      services: {
        type: DataTypes.JSON,
        allowNull: true,
        validate: {
          isArrayOfStrings(value) {
            if (value == null) return;
            if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
              throw new Error('services must be an array of strings');
            }
          },
        },
      },
      budget: { type: DataTypes.STRING(100), allowNull: true },
      phone: { type: DataTypes.STRING(50), allowNull: true },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { isEmail: true },
      },
      note: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('new', 'reviewed', 'contacted', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'submitted_at',
      },
      readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
    },
    {
      tableName: 'leads',
      timestamps: false,
      underscored: true,
      indexes: [
        { name: 'idx_leads_status', fields: ['status'] },
        { name: 'idx_leads_market', fields: ['market'] },
        { name: 'idx_leads_submitted_at', fields: [{ name: 'submitted_at', order: 'DESC' }] },
      ],
    }
  );

  return Lead;
};
