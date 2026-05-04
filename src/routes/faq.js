const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MUTABLE_FIELDS = ['questionEn', 'answerEn', 'questionAr', 'answerAr', 'enabled', 'sortOrder'];

function pickMutable(body = {}) {
  const out = {};
  for (const k of MUTABLE_FIELDS) if (k in body) out[k] = body[k];
  return out;
}

router.get('/', async (_req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const rows = await FaqItem.findAll({ where: { enabled: true }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/admin', requireAuth, async (_req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const rows = await FaqItem.findAll({ order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const row = await FaqItem.create(pickMutable(req.body));
    return res.status(201).json(row);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const row = await FaqItem.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'FAQ item not found' });
    await row.update(pickMutable(req.body));
    return res.json(row);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.patch('/:id/order', requireAuth, async (req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const order = Number(req.body?.order);
    if (!Number.isFinite(order)) return res.status(400).json({ error: 'order must be a number' });
    const row = await FaqItem.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'FAQ item not found' });
    row.sortOrder = order;
    await row.save();
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { FaqItem } = require('../models');
    const row = await FaqItem.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'FAQ item not found' });
    await row.destroy();
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
