const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const logger = require('../config/logger');

const router = express.Router();

const MUTABLE_FIELDS = [
  'client', 'title', 'industry', 'market', 'services',
  'challenge', 'outcome', 'coverImage', 'coverPublicId',
  'accentColor', 'slug', 'status', 'sortOrder',
];

function pickMutable(body = {}) {
  const out = {};
  for (const k of MUTABLE_FIELDS) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

// Public list
router.get('/', async (_req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const rows = await CaseStudy.findAll({
      where: { status: 'published' },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// Admin list (must come before /:slug to avoid collision)
router.get('/admin', requireAuth, async (_req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const rows = await CaseStudy.findAll({ order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// Public single by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const row = await CaseStudy.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!row) return res.status(404).json({ error: 'Case study not found' });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const data = pickMutable(req.body);
    const row = await CaseStudy.create(data);
    return res.status(201).json(row);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Slug must be unique' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const row = await CaseStudy.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Case study not found' });
    const data = pickMutable(req.body);
    await row.update(data);
    return res.json(row);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Slug must be unique' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:id/order', requireAuth, async (req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const order = Number(req.body?.order);
    if (!Number.isFinite(order)) return res.status(400).json({ error: 'order must be a number' });
    const row = await CaseStudy.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Case study not found' });
    row.sortOrder = order;
    await row.save();
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { CaseStudy } = require('../models');
    const row = await CaseStudy.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Case study not found' });

    if (row.coverPublicId) {
      try {
        await cloudinary.uploader.destroy(row.coverPublicId);
      } catch (err) {
        logger.warn({ err: err.message, publicId: row.coverPublicId }, 'cloudinary destroy failed');
      }
    }
    await row.destroy();
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
