const express = require('express');
const { requireAuth } = require('../middleware/auth');
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

// One-shot seed endpoint (gated by env flag)
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

module.exports = router;
