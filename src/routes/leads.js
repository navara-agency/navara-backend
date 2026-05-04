const express = require('express');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('../middleware/auth');
const { sendLeadNotification, sendBookingConfirmation } = require('../services/email');
const { createBooking } = require('../services/calcom');
const logger = require('../config/logger');

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

const VALID_MARKETS = ['Egypt', 'KSA', 'Other'];
const VALID_STATUSES = ['new', 'reviewed', 'contacted', 'closed'];

function sanitiseLeadInput(body = {}) {
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    company: typeof body.company === 'string' ? body.company.trim() : '',
    market: typeof body.market === 'string' ? body.market : '',
    industry: typeof body.industry === 'string' ? body.industry.trim() : '',
    goal: typeof body.goal === 'string' ? body.goal.trim() : null,
    services: Array.isArray(body.services) ? body.services.filter((s) => typeof s === 'string') : null,
    budget: typeof body.budget === 'string' ? body.budget.trim() : null,
    phone: typeof body.phone === 'string' ? body.phone.trim() : null,
    email: typeof body.email === 'string' ? body.email.trim() : '',
    note: typeof body.note === 'string' ? body.note : null,
  };
}

function pickBookingInputs(body = {}) {
  return {
    preferredDateTime: typeof body.preferredDateTime === 'string' ? body.preferredDateTime.trim() : null,
    timezone: typeof body.timezone === 'string' ? body.timezone.trim() : null,
  };
}

// POST /api/leads — public
router.post('/', submitLimiter, async (req, res, next) => {
  try {
    // Honeypot — if filled, reject as bot (R13).
    // Field name is intentionally obscure: browsers/password managers auto-fill fields
    // named "website" / "url" / "homepage" with the visitor's saved values, which would
    // reject legitimate submissions. Bots fill ALL fields, so an obscure name still catches them.
    const honeypot = req.body?.nv_check_x;
    if (typeof honeypot === 'string' && honeypot.trim() !== '') {
      return res.status(400).json({ error: 'Invalid submission' });
    }
    // Backwards-compat: also reject the legacy "website" honeypot if a stale frontend
    // is still posting it AND it has a value (shouldn't happen after the rename).
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '' && /^https?:\/\//i.test(req.body.website)) {
      // Skip — almost certainly browser autofill, not a bot
    }

    const data = sanitiseLeadInput(req.body);

    if (!data.name || !data.company || !data.industry || !data.market || !data.email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!VALID_MARKETS.includes(data.market)) {
      return res.status(400).json({ error: 'Invalid market' });
    }
    if (!validator.isEmail(data.email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const { Lead } = require('../models');
    const lead = await Lead.create({ ...data, status: 'new' });

    // Email failure must NOT block lead capture (FR-010, R7)
    try {
      await sendLeadNotification(lead);
    } catch (err) {
      logger.error({ err: err.message, lead: { id: lead.id } }, 'lead notification email failed');
    }

    // Auto-create the Cal.com booking when the visitor picked a date+time.
    // Booking failure must NOT block lead capture either — log and move on so the lead is safe.
    let booking = null;
    const { preferredDateTime, timezone } = pickBookingInputs(req.body);
    if (preferredDateTime) {
      try {
        const result = await createBooking({
          startIso: preferredDateTime,
          name: data.name,
          email: data.email,
          phone: data.phone,
          market: data.market,
          timezone: timezone,
          notes: data.note,
        });
        if (result.ok) {
          booking = {
            id: result.booking?.id || result.booking?.uid || null,
            uid: result.booking?.uid || null,
            url: result.booking?.responses?.location?.value || result.booking?.location || null,
            status: 'confirmed',
          };

          // Send our own confirmation email from configured SMTP, in addition to or instead of Cal.com's.
          // Gated by env flag:
          //   EMAIL_BOOKING_CONFIRMATIONS=true   → our SMTP sends confirmation to visitor (cc admin)
          //   EMAIL_BOOKING_CONFIRMATIONS unset  → only Cal.com emails (default)
          if (process.env.EMAIL_BOOKING_CONFIRMATIONS === 'true') {
            try {
              await sendBookingConfirmation(lead, result.booking, timezone);
            } catch (err) {
              logger.warn({ err: err.message, lead: { id: lead.id } }, 'booking confirmation email failed');
            }
          }
        } else if (!result.skipped) {
          booking = { status: 'failed', error: result.error };
        }
      } catch (err) {
        logger.error({ err: err.message, lead: { id: lead.id } }, 'cal.com booking errored');
        booking = { status: 'failed', error: err.message };
      }
    }

    return res.status(201).json({ success: true, id: lead.id, booking });
  } catch (err) {
    return next(err);
  }
});

// GET /api/leads — admin
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { Lead } = require('../models');
    const where = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) where.status = req.query.status;
    if (req.query.market && VALID_MARKETS.includes(req.query.market)) where.market = req.query.market;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const { rows, count } = await Lead.findAndCountAll({
      where,
      order: [['submittedAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      leads: rows,
      total: count,
      page,
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/leads/:id — admin
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { Lead } = require('../models');
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.readAt) {
      lead.readAt = new Date();
      await lead.save();
    }
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/leads/:id/status — admin
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { Lead } = require('../models');
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    lead.status = status;
    await lead.save();
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/leads/:id — admin
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { Lead } = require('../models');
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    await lead.destroy();
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
