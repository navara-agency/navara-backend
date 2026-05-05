const merge = require('lodash.merge');

// Sequelize's JSON column type sometimes hands back a string instead of a parsed
// object (varies by DB driver/version). If we don't normalise, lodash.merge spreads
// that string character-by-character producing { "0":"{", "1":"\"", ... } — which is
// exactly how this bug corrupted prod data. Always normalise on read.
function normalize(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) return {};
  if (typeof value !== 'object') return {};
  // Detect the legacy character-indexed corruption pattern: { "0":"{","1":"\"", ... }
  // and recover the original by reassembling the chars and parsing.
  const keys = Object.keys(value);
  if (keys.length > 10 && keys.every((k) => /^\d+$/.test(k))) {
    const reassembled = keys
      .map((k) => Number(k))
      .sort((a, b) => a - b)
      .map((idx) => value[String(idx)])
      .join('');
    try {
      const parsed = JSON.parse(reassembled);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
    return {};
  }
  return value;
}

async function getTranslations(lang) {
  const { Translation } = require('../models');
  const row = await Translation.findOne({ where: { lang } });
  return row ? { lang: row.lang, keys: normalize(row.keysJson) } : null;
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
  const merged = merge({}, normalize(row.keysJson), partial);
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
