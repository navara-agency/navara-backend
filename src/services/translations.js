const merge = require('lodash.merge');

// Sequelize's JSON column type sometimes hands back a string instead of a parsed
// object (varies by DB driver/version). If we don't normalise, lodash.merge spreads
// that string character-by-character producing { "0":"{", "1":"\"", ... } — which is
// exactly how this bug corrupted prod data. Always normalise on read.
// Recovers translation data from any of three corrupted shapes that have appeared in
// prod, recursing if necessary:
//   1. A JSON-string of a real object        → parse, return the object
//   2. A JSON-string of a character-indexed   → parse + reassemble + re-parse
//   3. A character-indexed object directly    → reassemble + parse
//   4. A normal object                        → return as-is
function normalize(value) {
  // Hard guard against runaway recursion on weird input
  for (let i = 0; i < 5; i += 1) {
    if (value == null) return {};
    // Case 1 / 2: string — try to parse, then re-evaluate the result
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
        continue; // re-check the parsed result
      } catch {
        return {};
      }
    }
    if (Array.isArray(value)) return {};
    if (typeof value !== 'object') return {};
    // Case 3: character-indexed object — reassemble chars, parse, re-evaluate
    const keys = Object.keys(value);
    if (keys.length > 10 && keys.every((k) => /^\d+$/.test(k))) {
      value = keys
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((idx) => value[String(idx)])
        .join('');
      continue; // result is a string — loop will parse it
    }
    // Case 4: normal object — done
    return value;
  }
  // Hit max recursion depth — give up rather than loop forever
  return {};
}

async function getTranslations(lang) {
  const { Translation } = require('../models');
  const row = await Translation.findOne({ where: { lang } });
  if (!row) return null;

  const original = row.keysJson;
  const normalized = normalize(original);

  // Self-heal: if normalisation rebuilt a corrupt row, write the clean version
  // back so future reads are O(1) and future merges don't re-corrupt.
  // Detect "we changed something" cheaply by comparing reference identity OR
  // by checking if original was a string / had numeric top-level keys.
  const wasCorrupted =
    typeof original === 'string' ||
    (original && typeof original === 'object' && Object.keys(original).length > 10 &&
      Object.keys(original).every((k) => /^\d+$/.test(k)));

  if (wasCorrupted && normalized && Object.keys(normalized).length > 0) {
    try {
      row.keysJson = normalized;
      await row.save();
    } catch { /* non-fatal — return normalized anyway */ }
  }

  return { lang: row.lang, keys: normalized };
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
