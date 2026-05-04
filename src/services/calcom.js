const logger = require('../config/logger');

/**
 * Cal.com v2 bookings — creates a confirmed booking for the visitor on submit.
 * Picks the event type per market so an Egyptian visitor lands on the EG calendar
 * and a Saudi visitor lands on the KSA one.
 *
 * Env vars (all optional — if not set, booking is skipped silently and the lead is still saved):
 *   CAL_API_KEY              — Cal.com personal API key (Settings → Developer → API keys)
 *   CAL_EVENT_TYPE_ID_EGYPT  — numeric ID of the EG discovery-call event type
 *   CAL_EVENT_TYPE_ID_KSA    — numeric ID of the KSA discovery-call event type
 *   CAL_EVENT_TYPE_ID        — fallback if the per-market ones aren't set
 */

const CAL_API_BASE = 'https://api.cal.com/v2';

function eventTypeIdForMarket(market) {
  if (market === 'KSA' && process.env.CAL_EVENT_TYPE_ID_KSA) {
    return Number(process.env.CAL_EVENT_TYPE_ID_KSA);
  }
  if (market === 'Egypt' && process.env.CAL_EVENT_TYPE_ID_EGYPT) {
    return Number(process.env.CAL_EVENT_TYPE_ID_EGYPT);
  }
  if (process.env.CAL_EVENT_TYPE_ID) {
    return Number(process.env.CAL_EVENT_TYPE_ID);
  }
  return null;
}

function timezoneForMarket(market) {
  if (market === 'KSA') return 'Asia/Riyadh';
  return 'Africa/Cairo';
}

/**
 * @param {object} args
 * @param {string} args.startIso  ISO 8601 start time (e.g. "2026-05-02T10:00:00.000Z")
 * @param {string} args.name      Attendee full name
 * @param {string} args.email     Attendee email
 * @param {string} [args.phone]   Optional phone for SMS notifications
 * @param {string} [args.timezone] IANA timezone (defaults from market)
 * @param {string} [args.market]  'Egypt' | 'KSA' | 'Other'
 * @param {string} [args.notes]   Free-form text appended to the booking
 *
 * @returns {Promise<{ ok: boolean, booking?: object, error?: string, skipped?: boolean }>}
 */
async function createBooking({ startIso, name, email, phone, timezone, market, notes }) {
  const apiKey = process.env.CAL_API_KEY;
  const eventTypeId = eventTypeIdForMarket(market);

  if (!apiKey || !eventTypeId) {
    return { ok: false, skipped: true, error: 'Cal.com not configured (CAL_API_KEY / event type IDs missing)' };
  }
  if (!startIso || !name || !email) {
    return { ok: false, error: 'startIso, name, and email are required' };
  }

  const tz = timezone || timezoneForMarket(market);

  const body = {
    start: startIso,
    eventTypeId,
    attendee: {
      name,
      email,
      timeZone: tz,
      language: 'en',
      ...(phone ? { phoneNumber: phone } : {}),
    },
    ...(notes ? { metadata: { source: 'navara-website', notes: notes.slice(0, 500) } } : { metadata: { source: 'navara-website' } }),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${CAL_API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'cal-api-version': '2024-08-13',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.error?.message || json?.message || `cal.com status ${res.status}`;
      logger.warn({ status: res.status, message, eventTypeId }, 'cal.com booking failed');
      return { ok: false, error: message };
    }

    const booking = json?.data || json;
    logger.info({ bookingId: booking?.id || booking?.uid, eventTypeId, market }, 'cal.com booking created');
    return { ok: true, booking };
  } catch (err) {
    logger.warn({ err: err.message }, 'cal.com booking request errored');
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch real availability from Cal.com for a given date + market. Cal.com requires the
 * booking `start` to match a slot it actually offers, so we ask Cal.com directly instead
 * of guessing with a hardcoded grid (which produced "can't be booked" 400s).
 *
 * @param {object} args
 * @param {string} args.date       YYYY-MM-DD
 * @param {string} [args.market]   'Egypt' | 'KSA'
 * @param {string} [args.timezone] IANA timezone (defaults from market)
 * @returns {Promise<{ ok: boolean, skipped?: boolean, slots?: Array<{start: string}>, error?: string }>}
 */
async function getSlots({ date, market, timezone } = {}) {
  try {
    const apiKey = process.env.CAL_API_KEY;
    const eventTypeId = eventTypeIdForMarket(market);

    if (!apiKey || !eventTypeId) {
      return { ok: false, skipped: true, error: 'Cal.com not configured' };
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'date (YYYY-MM-DD) required' };
    }

    const tz = timezone || timezoneForMarket(market);
    // Query the full day in UTC — Cal.com applies the timezone to display.
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const url = new URL(`${CAL_API_BASE}/slots`);
    url.searchParams.set('eventTypeId', String(eventTypeId));
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    url.searchParams.set('timeZone', tz);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res;
    try {
      res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'cal-api-version': '2024-09-04',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.error?.message || json?.message || `cal.com slots ${res.status}`;
      logger.warn({ status: res.status, message, eventTypeId, body: json }, 'cal.com slots failed');
      return { ok: false, error: message };
    }

    // DEBUG: dump the raw Cal.com response so we can see why a given date is empty.
    // Default OFF in production. Set CAL_DEBUG=true in dev when troubleshooting.
    if (process.env.CAL_DEBUG === 'true' && process.env.NODE_ENV !== 'production') {
      logger.info(
        { date, market, eventTypeId, tz, requestedStart: start, requestedEnd: end, calRaw: json },
        'cal.com /slots response (debug)'
      );
    }

    // Normalise response shapes across Cal.com versions:
    //   { data: { "2025-04-30": [{ start: "..." }] } }
    //   { data: { "2025-04-30": [{ time: "..." }] } }
    //   { data: [{ start: "..." }, ...] }
    //   { slots: { ... } }   (older shape)
    const data = json?.data ?? json?.slots ?? json;
    const slots = [];
    const pushSlot = (s) => {
      const iso = (s && (s.start || s.time)) || (typeof s === 'string' ? s : null);
      if (typeof iso === 'string') slots.push({ start: iso });
    };

    try {
      if (Array.isArray(data)) {
        data.forEach(pushSlot);
      } else if (data && typeof data === 'object') {
        for (const v of Object.values(data)) {
          if (!v) continue;
          if (Array.isArray(v)) v.forEach(pushSlot);
          else if (typeof v === 'object') {
            for (const vv of Object.values(v)) {
              if (Array.isArray(vv)) vv.forEach(pushSlot);
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'cal.com slots normalisation errored — returning empty slot list');
    }

    if (process.env.CAL_DEBUG === 'true' && process.env.NODE_ENV !== 'production') {
      logger.info({ date, extractedCount: slots.length, firstSlot: slots[0]?.start || null }, 'cal.com /slots normalised');
    }

    return { ok: true, slots };
  } catch (err) {
    logger.warn({ err: err.message, stack: err.stack }, 'cal.com getSlots threw');
    return { ok: false, error: err.message || 'unknown getSlots error' };
  }
}

module.exports = { createBooking, getSlots, eventTypeIdForMarket, timezoneForMarket };
