const express = require('express');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('../middleware/auth');
const { sendLeadNotification, sendBookingConfirmation } = require('../services/email');
const { createBooking } = require('../services/calcom');
const { scheduleReminder } = require('../services/reminderQueue');
const logger = require('../config/logger');

const router = express.Router();

// Cal.com sends a non-suppressible confirmation + reminder to whichever attendee email
// we hand its API. To stop those reaching the visitor (we send our own branded SMTP emails
// instead), we book Cal.com with a fake address on a domain we control. The real visitor
// email stays in our leads table and is what our SMTP confirmation/reminder targets.
// Override via env if needed.
const CAL_FAKE_ATTENDEE_EMAIL = process.env.CAL_FAKE_ATTENDEE_EMAIL || 'bookings@navaraagency.com';

// Phone country code → internal market ENUM. We no longer ask the visitor for their market;
// the phone's dial code is the source of truth. Anything else falls back to 'Other'.
function deriveMarketFromPhone(phone) {
  if (!phone) return 'Other';
  const s = String(phone).replace(/\s+/g, '');
  if (s.startsWith('+20')) return 'Egypt';
  if (s.startsWith('+966')) return 'KSA';
  return 'Other';
}

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
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    company: typeof body.company === 'string' ? body.company.trim() : '',
    // Market is derived from the phone country code — visitors no longer pick it.
    market: deriveMarketFromPhone(phone),
    industry: typeof body.industry === 'string' ? body.industry.trim() : '',
    goal: typeof body.goal === 'string' ? body.goal.trim() : '',
    services: Array.isArray(body.services) ? body.services.filter((s) => typeof s === 'string') : null,
    budget: typeof body.budget === 'string' ? body.budget.trim() : '',
    phone,
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
    const { preferredDateTime, timezone } = pickBookingInputs(req.body);

    // Required fields — only `services` and `note` are optional now. `market` is derived
    // from the phone, so it doesn't need to be in this list.
    if (!data.name || !data.company || !data.industry || !data.goal || !data.budget
        || !data.phone || !data.email || !preferredDateTime) {
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

    // Auto-create the Cal.com booking — visitor already picked a date+time (now required).
    // Booking failure must NOT block lead capture either — log and move on so the lead is safe.
    let booking = null;
    if (preferredDateTime) {
      try {
        // Pass the FAKE attendee email so Cal.com doesn't email the visitor. The visitor's
        // real email is still in `lead.email` and is used by our SMTP confirmation +
        // reminder. Including the real email in `notes` keeps it visible in the Cal.com
        // booking record so we can still reconcile when reviewing bookings on cal.com.
        const result = await createBooking({
          startIso: preferredDateTime,
          name: data.name,
          email: CAL_FAKE_ATTENDEE_EMAIL,
          phone: data.phone,
          market: data.market,
          timezone: timezone,
          notes: [data.note, `Visitor email: ${data.email}`].filter(Boolean).join('\n'),
        });
        if (result.ok) {
          booking = {
            id: result.booking?.id || result.booking?.uid || null,
            uid: result.booking?.uid || null,
            url: result.booking?.responses?.location?.value || result.booking?.location || null,
            status: 'confirmed',
          };

          // Visitor-facing email #1: immediate confirmation. With Cal.com's confirmation
          // now redirected to the fake attendee email, this is the ONLY confirmation the
          // visitor sees. Fire-and-forget — never block lead capture if SMTP is flaky.
          if (process.env.EMAIL_BOOKING_CONFIRMATIONS !== 'false') {
            try {
              await sendBookingConfirmation(lead, result.booking, timezone);
            } catch (err) {
              logger.warn({ err: err.message, lead: { id: lead.id } }, 'booking confirmation email failed');
            }
          }

          // Visitor-facing email #2: 2h-before reminder (or ASAP if meeting is <2h away).
          // Persisted in booking_reminders so it survives server restarts. Gated by env flag.
          if (process.env.EMAIL_BOOKING_REMINDERS !== 'false') {
            try {
              await scheduleReminder({ lead, booking: result.booking, timezone });
            } catch (err) {
              logger.warn({ err: err.message, lead: { id: lead.id } }, 'scheduling booking reminder failed');
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
