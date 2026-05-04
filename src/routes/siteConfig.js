const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getReshaped, partialUpdate } = require('../services/siteConfig');

const router = express.Router();

// GET /api/site-config — public
router.get('/', async (_req, res, next) => {
  try {
    const cfg = await getReshaped();
    return res.json(cfg);
  } catch (err) {
    return next(err);
  }
});

// GET /api/site-config/admin — protected (semantically distinct, same payload)
router.get('/admin', requireAuth, async (_req, res, next) => {
  try {
    const cfg = await getReshaped();
    return res.json(cfg);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/site-config — admin partial update
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const updated = await partialUpdate(req.body || {});
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
