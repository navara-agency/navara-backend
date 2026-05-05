const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const { getTranslations, mergeTranslations, replaceTranslations } = require('../services/translations');

const router = express.Router();

const VALID_LANGS = ['en', 'ar'];

router.get('/:lang', async (req, res, next) => {
  try {
    const { lang } = req.params;
    if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: 'Unknown language' });
    const result = await getTranslations(lang);
    if (!result) return res.status(404).json({ error: 'Translations not found' });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.put('/:lang', requireAuth, async (req, res, next) => {
  try {
    const { lang } = req.params;
    if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: 'Unknown language' });
    const keys = req.body?.keys;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys must be a plain object' });
    }
    await mergeTranslations(lang, keys);
    const result = await getTranslations(lang);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// One-shot seed endpoint (gated by env flag) — accepts JSON in the request body
router.post('/seed', requireAuth, async (req, res, next) => {
  try {
    if (process.env.ALLOW_TRANSLATION_SEED !== 'true') {
      return res.status(403).json({ error: 'Translation seed is disabled' });
    }
    const { en, ar } = req.body || {};
    if (en && typeof en === 'object' && !Array.isArray(en)) {
      await replaceTranslations('en', en);
    }
    if (ar && typeof ar === 'object' && !Array.isArray(ar)) {
      await replaceTranslations('ar', ar);
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Disaster-recovery: restore en + ar from the bundled JSON files in
// src/scripts/locales/. Use this after a corrupted save (e.g., the
// character-indexed object bug) has wiped real content.
// Admin auth required + ALLOW_TRANSLATION_SEED=true gate so this can't be
// triggered accidentally.
router.post('/restore-from-bundled', requireAuth, async (_req, res, next) => {
  try {
    if (process.env.ALLOW_TRANSLATION_SEED !== 'true') {
      return res.status(403).json({ error: 'Set ALLOW_TRANSLATION_SEED=true to enable restore' });
    }
    const localesDir = path.join(__dirname, '..', 'scripts', 'locales');
    const enPath = path.join(localesDir, 'en.json');
    const arPath = path.join(localesDir, 'ar.json');

    const restored = {};
    if (fs.existsSync(enPath)) {
      const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
      await replaceTranslations('en', en);
      restored.en = Object.keys(en).length;
    }
    if (fs.existsSync(arPath)) {
      const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
      await replaceTranslations('ar', ar);
      restored.ar = Object.keys(ar).length;
    }
    logger.info({ restored }, 'translations restored from bundled JSON');
    return res.json({ success: true, restored });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
