const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendTestEmail } = require('../services/email');

const router = express.Router();

const MASK = '••••••••';
const MUTABLE_FIELDS = [
  'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass',
  'fromName', 'fromEmail', 'notifyEmail',
];

function maskedView(row) {
  if (!row) return null;
  const data = row.get ? row.get({ plain: true }) : row;
  return {
    ...data,
    smtpPass: data.smtpPass ? MASK : null,
  };
}

function pickMutable(body = {}) {
  const out = {};
  for (const k of MUTABLE_FIELDS) if (k in body) out[k] = body[k];
  // FR-022 — never overwrite stored password if mask sentinel submitted
  if (out.smtpPass === MASK) delete out.smtpPass;
  return out;
}

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { EmailConfig } = require('../models');
    const row = await EmailConfig.findByPk(1);
    return res.json(maskedView(row));
  } catch (err) {
    return next(err);
  }
});

router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { EmailConfig } = require('../models');
    const data = pickMutable(req.body || {});
    const existing = await EmailConfig.findByPk(1);
    const merged = { ...(existing ? existing.get({ plain: true }) : {}), ...data, id: 1 };
    delete merged.created_at;
    delete merged.createdAt;
    await EmailConfig.upsert(merged);
    const row = await EmailConfig.findByPk(1);
    return res.json(maskedView(row));
  } catch (err) {
    if (err.name === 'SequelizeValidationError') return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.post('/test', requireAuth, async (_req, res) => {
  try {
    await sendTestEmail();
    return res.json({ success: true });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Test email failed' });
  }
});

module.exports = router;
