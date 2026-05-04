const express = require('express');
const calcom = require('../services/calcom');
const logger = require('../config/logger');

const router = express.Router();

// GET /api/calcom/slots?date=YYYY-MM-DD&market=Egypt|KSA&timezone=...
// Public — visitors need real availability before they can pick a slot in the contact form.
// Never returns 5xx: any failure degrades to { configured: false, slots: [] } so the form
// can show its manual fallback. The actual error is logged server-side.
router.get('/slots', async (req, res) => {
  try {
    const { date, market, timezone } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    }

    let result;
    try {
      result = await calcom.getSlots({ date, market, timezone });
    } catch (err) {
      logger.warn({ err: err.message }, 'getSlots threw — degrading to manual fallback');
      return res.json({ configured: false, slots: [], error: err.message });
    }

    if (!result || result.skipped) {
      return res.json({ configured: false, slots: [] });
    }
    if (!result.ok) {
      // Soft-fail: log + tell the frontend Cal.com refused, but don't 5xx.
      logger.warn({ error: result.error, date, market }, 'cal.com slots refused');
      return res.json({ configured: true, slots: [], error: result.error });
    }
    return res.json({ configured: true, slots: result.slots || [] });
  } catch (err) {
    // Outer safety net — should never hit, but keep the route from ever 500ing.
    logger.error({ err: err.message }, 'slots route outer error');
    return res.json({ configured: false, slots: [], error: 'internal error' });
  }
});

module.exports = router;
