const merge = require('lodash.merge');

async function getTranslations(lang) {
  const { Translation } = require('../models');
  const row = await Translation.findOne({ where: { lang } });
  return row ? { lang: row.lang, keys: row.keysJson } : null;
}

async function mergeTranslations(lang, partial) {
  const { Translation } = require('../models');
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    throw new Error('partial keys must be a plain object');
  }
  const row = await Translation.findOne({ where: { lang } });
  if (!row) {
    return Translation.create({ lang, keysJson: partial });
  }
  const merged = merge({}, row.keysJson || {}, partial);
  row.keysJson = merged;
  await row.save();
  return row;
}

async function replaceTranslations(lang, keys) {
  const { Translation } = require('../models');
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new Error('keys must be a plain object');
  }
  const [row, created] = await Translation.findOrCreate({ where: { lang }, defaults: { lang, keysJson: keys } });
  if (!created) {
    row.keysJson = keys;
    await row.save();
  }
  return row;
}

module.exports = { getTranslations, mergeTranslations, replaceTranslations };
