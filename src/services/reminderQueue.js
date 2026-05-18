const logger = require('../config/logger');
const { sendBookingReminder } = require('./email');

// How often the queue scans for due reminders. Keep it small enough that a "send ASAP"
// reminder (booking <2h away) feels immediate, but not so small that we hammer the DB.
const POLL_INTERVAL_MS = 60 * 1000; // 60s

// How early before the meeting the reminder should fire.
const REMINDER_LEAD_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours

// Cap retries so a permanently broken SMTP setup doesn't keep eating cycles.
const MAX_ATTEMPTS = 5;

let pollTimer = null;
let running = false;

/**
 * Compute when a reminder should be sent.
 *   - bookingStart > now + 2h  → fire at bookingStart - 2h
 *   - bookingStart ≤ now + 2h  → fire immediately (now)
 *   - bookingStart in the past → still fire immediately so the user gets *something* useful
 *     (the email still says "starting now / in N min" so it doesn't read as stale)
 */
function computeDueAt(bookingStart, now = new Date()) {
  const startMs = bookingStart instanceof Date ? bookingStart.getTime() : new Date(bookingStart).getTime();
  const reminderTime = startMs - REMINDER_LEAD_TIME_MS;
  return new Date(Math.max(reminderTime, now.getTime()));
}

/**
 * Persist a reminder row for a newly-created Cal.com booking. Idempotent on (leadId, bookingUid):
 * if a reminder already exists for the same booking it's left alone so retries don't dupe.
 *
 * @param {object} args
 * @param {object} args.lead     Persisted Lead row (.id, .email, .name required)
 * @param {object} args.booking  Cal.com booking response
 * @param {string} [args.timezone]
 * @returns {Promise<{ scheduled: boolean, reason?: string, dueAt?: Date, reminderId?: number }>}
 */
async function scheduleReminder({ lead, booking, timezone }) {
  if (!lead?.id || !lead?.email) {
    return { scheduled: false, reason: 'lead missing id/email' };
  }
  const startIso = booking?.start || booking?.startTime;
  if (!startIso) {
    return { scheduled: false, reason: 'booking.start missing' };
  }

  const { BookingReminder } = require('../models');
  const bookingStart = new Date(startIso);
  const dueAt = computeDueAt(bookingStart);
  const bookingUid = booking.uid || booking.id ? String(booking.uid || booking.id) : null;
  const meetingUrl = booking.meetingUrl || booking.location || null;

  // Idempotency: same lead + same booking should not produce two reminders.
  if (bookingUid) {
    const existing = await BookingReminder.findOne({ where: { leadId: lead.id, bookingUid } });
    if (existing) {
      logger.info({ reminderId: existing.id, leadId: lead.id }, 'reminder already scheduled, skipping duplicate');
      return { scheduled: false, reason: 'already exists', reminderId: existing.id };
    }
  }

  const row = await BookingReminder.create({
    leadId: lead.id,
    bookingUid,
    bookingStart,
    dueAt,
    timezone: timezone || null,
    meetingUrl,
    bookingSnapshot: booking,
    status: 'pending',
  });

  logger.info(
    { reminderId: row.id, leadId: lead.id, dueAt: dueAt.toISOString(), bookingStart: bookingStart.toISOString() },
    'booking reminder scheduled'
  );
  return { scheduled: true, dueAt, reminderId: row.id };
}

/**
 * One queue pass: find pending reminders whose dueAt has passed, send each, then mark sent/failed.
 * Errors per-row are isolated so one bad email doesn't poison the rest of the batch.
 */
async function processDue() {
  if (running) return; // overlap guard — a slow SMTP shouldn't queue two passes on top of each other
  running = true;
  try {
    const { BookingReminder, Lead } = require('../models');
    const { Op } = require('sequelize');
    const due = await BookingReminder.findAll({
      where: {
        status: 'pending',
        dueAt: { [Op.lte]: new Date() },
        attempts: { [Op.lt]: MAX_ATTEMPTS },
      },
      order: [['dueAt', 'ASC']],
      limit: 25,
    });

    for (const row of due) {
      try {
        const lead = await Lead.findByPk(row.leadId);
        if (!lead) {
          row.status = 'failed';
          row.lastError = 'lead row missing';
          await row.save();
          continue;
        }

        await sendBookingReminder(lead, row.bookingSnapshot || {}, row.timezone);
        row.status = 'sent';
        row.sentAt = new Date();
        row.attempts = row.attempts + 1;
        await row.save();
        logger.info({ reminderId: row.id, leadId: row.leadId }, 'booking reminder sent');
      } catch (err) {
        row.attempts = row.attempts + 1;
        row.lastError = err.message?.slice(0, 1000) || 'unknown';
        if (row.attempts >= MAX_ATTEMPTS) {
          row.status = 'failed';
        }
        await row.save();
        logger.warn({ err: err.message, reminderId: row.id, attempts: row.attempts }, 'booking reminder send failed');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'reminder queue tick errored');
  } finally {
    running = false;
  }
}

function start() {
  if (pollTimer) return;
  // First pass on boot picks up anything that came due while the server was down.
  processDue().catch((err) => logger.error({ err: err.message }, 'reminder queue boot tick errored'));
  pollTimer = setInterval(() => {
    processDue().catch((err) => logger.error({ err: err.message }, 'reminder queue tick errored'));
  }, POLL_INTERVAL_MS);
  // Don't hold the process open just for this timer — Node should exit cleanly on SIGTERM.
  if (typeof pollTimer.unref === 'function') pollTimer.unref();
  logger.info({ intervalMs: POLL_INTERVAL_MS }, 'reminder queue started');
}

function stop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

module.exports = { scheduleReminder, processDue, start, stop, computeDueAt };
