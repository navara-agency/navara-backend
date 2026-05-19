const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const { renderTemplate } = require('./emailTemplates');

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

/**
 * Common send pipeline: takes a rendered template (output of renderTemplate) + the
 * defaults that apply when the template's recipient fields are null, and dispatches via
 * nodemailer. Handles attachments, comma-separated lists for CC/BCC, and falls back to
 * the EmailConfig defaults when admin hasn't overridden a given field.
 *
 * @param {object} rendered   From renderTemplate()
 * @param {object} defaults   { to, cc?, replyTo? } used when template has no override
 */
async function dispatchRendered(rendered, defaults) {
  const { transport, fromName: configFromName, fromEmail: configFromEmail } = await getTransport();

  // Resolve sender/recipient values: template override → defaults → EmailConfig.
  const fromName = rendered.fromName || configFromName;
  const fromEmail = rendered.fromEmail || configFromEmail;
  const to = rendered.toAddress || defaults.to;
  const cc = rendered.ccAddress || defaults.cc || undefined;
  const bcc = rendered.bccAddress || undefined;
  const replyTo = rendered.replyToAddress || defaults.replyTo || undefined;

  if (!to) throw new Error('No To address resolved (template + default both empty)');

  // Nodemailer accepts comma-separated strings for to/cc/bcc directly, so admins can
  // type "a@x.com, b@y.com" into the dashboard fields.
  const message = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: rendered.subject,
    text: rendered.text,
    ...(rendered.html ? { html: rendered.html } : {}),
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
  };

  // Attachments — nodemailer downloads each URL and attaches as a real MIME part. We pass
  // the original filename so the recipient sees a sensible "Save as" name rather than
  // Cloudinary's hashed public_id.
  if (Array.isArray(rendered.attachments) && rendered.attachments.length) {
    message.attachments = rendered.attachments.map((a) => ({
      filename: a.filename || 'attachment',
      path: a.url,
      ...(a.contentType ? { contentType: a.contentType } : {}),
    }));
  }

  await transport.sendMail(message);
}

async function sendLeadNotification(lead) {
  const { fromEmail, notifyEmail } = await getTransport();
  if (!notifyEmail) throw new Error('notifyEmail not configured');

  const rendered = await renderTemplate('lead_notification', {
    leadName: lead.name,
    leadCompany: lead.company,
    leadEmail: lead.email,
    leadPhone: lead.phone || '-',
    leadMarket: lead.market,
    leadIndustry: lead.industry || '-',
    leadGoal: lead.goal || '-',
    leadServices: Array.isArray(lead.services) ? lead.services.join(', ') : '-',
    leadBudget: lead.budget || '-',
    leadNote: lead.note || '(none)',
    leadId: lead.id,
    submittedAt: lead.submittedAt?.toISOString?.() || String(lead.submittedAt || ''),
    // Recipient variables — usable in To/CC/BCC fields
    notifyEmail,
    fromEmail,
  });
  // Template disabled — admin explicitly turned it off. Treat as success (no-op).
  if (!rendered) return;

  await dispatchRendered(rendered, { to: notifyEmail });
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
 * Run AFTER a successful Cal.com booking — with Cal.com's emails redirected to a dummy
 * attendee address, this is the ONLY confirmation the visitor sees.
 *
 * @param {object} lead     Persisted Lead row (must have email + name)
 * @param {object} booking  Cal.com booking response — uses .start, .end, .meetingUrl, .uid
 * @param {string} [timezone] IANA timezone for time rendering
 */
async function sendBookingConfirmation(lead, booking, timezone) {
  if (!lead?.email) throw new Error('lead.email required');
  if (!booking) throw new Error('booking required');

  const { fromName, fromEmail, notifyEmail } = await getTransport();

  const start = booking.start || booking.startTime || null;
  const end = booking.end || booking.endTime || null;
  const meetingUrl = booking.meetingUrl || booking.location || '';
  const reschedule = booking.rescheduleUid
    ? `https://cal.com/reschedule/${booking.rescheduleUid}`
    : (booking.uid ? `https://cal.com/booking/${booking.uid}` : '');

  const startPretty = formatStartTime(start, timezone) || '';
  const durationMin = (end && start) ? Math.round((new Date(end) - new Date(start)) / 60000) : '';
  const dayShort = startPretty ? startPretty.split(',')[0] : '';

  const rendered = await renderTemplate('booking_confirmation', {
    visitorName: lead.name,
    visitorEmail: lead.email,
    companyName: fromName,
    meetingStart: startPretty,
    meetingDay: dayShort,
    meetingDuration: durationMin,
    meetingUrl,
    rescheduleUrl: reschedule,
    notifyEmail,
    fromEmail,
  }, {
    preheader: startPretty ? `Your discovery call is confirmed for ${startPretty}.` : 'Your discovery call is confirmed.',
  });
  if (!rendered) return;

  await dispatchRendered(rendered, {
    to: lead.email,
    cc: notifyEmail,
    replyTo: notifyEmail || fromEmail,
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

  const { fromName, fromEmail, notifyEmail } = await getTransport();

  const start = booking.start || booking.startTime || null;
  const end = booking.end || booking.endTime || null;
  const meetingUrl = booking.meetingUrl || booking.location || '';
  const reschedule = booking.rescheduleUid
    ? `https://cal.com/reschedule/${booking.rescheduleUid}`
    : (booking.uid ? `https://cal.com/booking/${booking.uid}` : '');

  const startPretty = formatStartTime(start, timezone) || '';
  const durationMin = (end && start) ? Math.round((new Date(end) - new Date(start)) / 60000) : '';
  const dayShort = startPretty ? startPretty.split(',')[0] : '';

  // Minutes until the call drives both the subject and the urgency wording in the body.
  // Floor at 0 so a slightly-past-due reminder still says "starting now" instead of negative.
  const minutesUntil = start
    ? Math.max(0, Math.round((new Date(start).getTime() - Date.now()) / 60000))
    : '';

  const rendered = await renderTemplate('booking_reminder', {
    visitorName: lead.name,
    visitorEmail: lead.email,
    companyName: fromName,
    meetingStart: startPretty,
    meetingDay: dayShort,
    meetingDuration: durationMin,
    meetingUrl,
    rescheduleUrl: reschedule,
    minutesUntil,
    notifyEmail,
    fromEmail,
  }, {
    preheader: startPretty ? `Reminder: your call is at ${startPretty}.` : 'Reminder: your call is coming up.',
  });
  if (!rendered) return;

  await dispatchRendered(rendered, {
    to: lead.email,
    cc: notifyEmail,
    replyTo: notifyEmail || fromEmail,
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
