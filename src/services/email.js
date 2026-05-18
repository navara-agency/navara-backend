const nodemailer = require('nodemailer');
const logger = require('../config/logger');

async function getTransport() {
  // DB-first per R6 — fall back to env if row missing or DB unreachable
  let cfg = null;
  try {
    const { EmailConfig } = require('../models');
    cfg = await EmailConfig.findByPk(1);
  } catch (err) {
    logger.warn({ err: err.message }, 'email config DB read failed; using env fallback');
  }

  const host = cfg?.smtpHost || process.env.SMTP_HOST;
  const port = cfg?.smtpPort || Number(process.env.SMTP_PORT) || 465;
  const secure = cfg?.smtpSecure ?? (process.env.SMTP_SECURE === 'false' ? false : true);
  const user = cfg?.smtpUser || process.env.SMTP_USER;
  const pass = cfg?.smtpPass || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing (need host/user/pass)');
  }

  return {
    transport: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
    fromName: cfg?.fromName || 'Navara',
    fromEmail: cfg?.fromEmail || user,
    notifyEmail: cfg?.notifyEmail || process.env.NOTIFY_EMAIL,
  };
}

function formatLeadBody(lead) {
  return [
    `Name:     ${lead.name}`,
    `Company:  ${lead.company}`,
    `Market:   ${lead.market}`,
    `Industry: ${lead.industry}`,
    `Goal:     ${lead.goal || '-'}`,
    `Services: ${Array.isArray(lead.services) ? lead.services.join(', ') : '-'}`,
    `Budget:   ${lead.budget || '-'}`,
    `Phone:    ${lead.phone || '-'}`,
    `Email:    ${lead.email}`,
    '',
    'Note:',
    lead.note || '(none)',
    '',
    `Submitted at: ${lead.submittedAt?.toISOString?.() || lead.submittedAt}`,
    `Lead ID: ${lead.id}`,
  ].join('\n');
}

async function sendLeadNotification(lead) {
  const { transport, fromName, fromEmail, notifyEmail } = await getTransport();
  if (!notifyEmail) throw new Error('notifyEmail not configured');

  const subject = `New Lead: ${lead.name} from ${lead.company} (${lead.market})`;
  const text = formatLeadBody(lead);

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: notifyEmail,
    subject,
    text,
  });
}

async function sendTestEmail() {
  const { transport, fromName, fromEmail, notifyEmail } = await getTransport();
  if (!notifyEmail) throw new Error('notifyEmail not configured');

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: notifyEmail,
    subject: 'Navara — SMTP test email',
    text: `This is a test email from the Navara backend at ${new Date().toISOString()}.\n\nIf you received this, your SMTP configuration is working correctly.`,
  });
}

function formatStartTime(iso, timezone) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      timeZone: timezone || undefined,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Sends a "your call is confirmed" email to the visitor (To) and CCs the admin (notifyEmail).
 * Run AFTER a successful Cal.com booking — if Cal.com's own emails are disabled, this becomes
 * the single source of confirmation.
 *
 * @param {object} lead     The persisted Lead row (must have email + name)
 * @param {object} booking  Cal.com booking response — uses .start, .end, .meetingUrl, .uid
 * @param {string} [timezone] IANA timezone for time rendering (defaults to lead's market)
 */
async function sendBookingConfirmation(lead, booking, timezone) {
  if (!lead?.email) throw new Error('lead.email required');
  if (!booking) throw new Error('booking required');

  const { transport, fromName, fromEmail, notifyEmail } = await getTransport();

  const start = booking.start || booking.startTime || null;
  const end = booking.end || booking.endTime || null;
  const meetingUrl = booking.meetingUrl || booking.location || null;
  const reschedule = booking.rescheduleUid
    ? `https://cal.com/reschedule/${booking.rescheduleUid}`
    : (booking.uid ? `https://cal.com/booking/${booking.uid}` : null);

  const startPretty = formatStartTime(start, timezone);

  const lines = [
    `Hi ${lead.name},`,
    '',
    `Thanks for booking a call with ${fromName}. Your discovery call is confirmed:`,
    '',
    startPretty ? `📅  ${startPretty}` : null,
    end && start ? `⏱   ${Math.round((new Date(end) - new Date(start)) / 60000)} minutes` : null,
    meetingUrl ? `🔗  ${meetingUrl}` : null,
    '',
    reschedule ? `Need to reschedule? ${reschedule}` : null,
    '',
    `If anything comes up before then, just reply to this email — we'll be in touch.`,
    '',
    `— ${fromName}`,
  ].filter(Boolean).join('\n');

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: lead.email,
    cc: notifyEmail || undefined,
    replyTo: notifyEmail || fromEmail,
    subject: `Your call with ${fromName} is confirmed${startPretty ? ` — ${startPretty.split(',')[0]}, ${startPretty.split(',')[1]?.trim() || ''}` : ''}`,
    text: lines,
  });
}

/**
 * Sends a "your call starts soon" reminder to the visitor (To) and CCs the admin.
 * Run by the reminder queue ~2 hours before the meeting (or ASAP if the meeting is closer).
 * Distinct from sendBookingConfirmation, which announces an initial confirmation.
 *
 * @param {object} lead     Persisted Lead row (needs email + name)
 * @param {object} booking  Cal.com booking — uses .start, .end, .meetingUrl, .uid
 * @param {string} [timezone] IANA timezone for rendering
 */
async function sendBookingReminder(lead, booking, timezone) {
  if (!lead?.email) throw new Error('lead.email required');
  if (!booking) throw new Error('booking required');

  const { transport, fromName, fromEmail, notifyEmail } = await getTransport();

  const start = booking.start || booking.startTime || null;
  const end = booking.end || booking.endTime || null;
  const meetingUrl = booking.meetingUrl || booking.location || null;
  const reschedule = booking.rescheduleUid
    ? `https://cal.com/reschedule/${booking.rescheduleUid}`
    : (booking.uid ? `https://cal.com/booking/${booking.uid}` : null);

  const startPretty = formatStartTime(start, timezone);

  // How long until the call (rounded to nearest minute) — drives the subject line wording
  // for both the 2h-ahead case and the "we just booked you in <30min" edge case.
  let minutesUntil = null;
  if (start) {
    minutesUntil = Math.max(0, Math.round((new Date(start).getTime() - Date.now()) / 60000));
  }
  const subject =
    minutesUntil != null && minutesUntil <= 5
      ? `Your call with ${fromName} is starting now`
      : minutesUntil != null && minutesUntil < 120
      ? `Reminder: your call with ${fromName} starts in ${minutesUntil} min`
      : `Reminder: your call with ${fromName} starts in 2 hours`;

  const lines = [
    `Hi ${lead.name},`,
    '',
    `Quick reminder — your discovery call with ${fromName} is coming up:`,
    '',
    startPretty ? `📅  ${startPretty}` : null,
    end && start ? `⏱   ${Math.round((new Date(end) - new Date(start)) / 60000)} minutes` : null,
    meetingUrl ? `🔗  ${meetingUrl}` : null,
    '',
    `We recommend joining a couple of minutes early to test your audio.`,
    reschedule ? `Need to reschedule? ${reschedule}` : null,
    '',
    `If something has come up, just reply to this email and we'll work it out.`,
    '',
    `— ${fromName}`,
  ].filter(Boolean).join('\n');

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: lead.email,
    cc: notifyEmail || undefined,
    replyTo: notifyEmail || fromEmail,
    subject,
    text: lines,
  });
}

module.exports = {
  getTransport,
  sendLeadNotification,
  sendTestEmail,
  sendBookingConfirmation,
  sendBookingReminder,
  formatLeadBody,
};
