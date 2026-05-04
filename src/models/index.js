const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/db');

const models = {};
const here = __dirname;

for (const file of fs.readdirSync(here)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  const factory = require(path.join(here, file));
  if (typeof factory !== 'function') continue;
  const model = factory(sequelize);
  models[model.name] = model;
}

models.sequelize = sequelize;

module.exports = models;
