const { DataTypes } = require('sequelize');

// Singleton row (id=1) holding the live admin credentials. When the row exists, auth
// reads username + passwordHash from here; otherwise it falls back to ADMIN_USERNAME +
// ADMIN_PASSWORD_HASH env vars (so an existing env-only deploy keeps working seamlessly).
module.exports = (sequelize) => {
  const AdminUser = sequelize.define(
    'AdminUser',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      username: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      tableName: 'admin_user',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return AdminUser;
};
