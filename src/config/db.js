const { Sequelize } = require('sequelize');
const configs = require('./sequelize');

const env = process.env.NODE_ENV || 'development';
const config = configs[env] || configs.development;

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

async function authenticate() {
  await sequelize.authenticate();
}

module.exports = { sequelize, authenticate };
