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

// Escape user-supplied strings before they land in the HTML body. Names, companies, and
// notes can technically contain markup characters; without escaping we'd render them as
// real HTML and open a small injection vector.
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps inner HTML in the shared Navara email layout: top gradient bar, logo, card body,
 * footer. Table-based + inline styles so it renders across Gmail / Outlook / Apple Mail.
 * The outer table is capped at 600px and the body uses Helvetica/Arial fallbacks since
 * Navara's brand fonts (Handicrafts, Somar) aren't email-safe.
 */
function renderEmailLayout({ preheader, innerHtml }) {
  const SITE = 'https://navaraagency.com';
  const LOGO = `${SITE}/nv-icon-192.png`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Navara</title>
</head>
<body style="margin:0;padding:0;background:#f5f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1235;">
  <!-- Preheader: hidden in body but shown in inbox preview -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader || '')}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f4fa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(82,55,159,0.08);">
          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(to right,#0044ff 0%,#3322cc 42%,#bb33aa 100%);">&nbsp;</td>
          </tr>

          <!-- Header: logo + wordmark -->
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${LOGO}" alt="Navara" width="36" height="36" style="display:block;border-radius:8px;">
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#001192;">
                    Navara
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 32px 32px;font-size:15px;line-height:1.6;color:#1a1235;">
              ${innerHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafaff;border-top:1px solid #ecebf5;padding:18px 32px;font-size:12px;color:#8e89a8;text-align:center;">
              Navara — integrated growth partner™<br>
              <a href="${SITE}" style="color:#52379f;text-decoration:none;">navaraagency.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Reusable HTML snippet for a "details box" that shows the meeting time, duration, and link
// inside a soft-bordered card. Used by both confirmation and reminder.
function renderDetailsBox({ startPretty, durationMin, meetingUrl }) {
  const rows = [];
  if (startPretty) {
    rows.push(`
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6b6580;width:90px;">When</td>
        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">${escapeHtml(startPretty)}</td>
      </tr>`);
  }
  if (durationMin) {
    rows.push(`
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6b6580;">Duration</td>
        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">${durationMin} minutes</td>
      </tr>`);
  }
  if (meetingUrl) {
    rows.push(`
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6b6580;">Where</td>
        <td style="padding:6px 0;font-size:14px;">
          <a href="${escapeHtml(meetingUrl)}" style="color:#0044ff;text-decoration:none;word-break:break-all;">${escapeHtml(meetingUrl)}</a>
        </td>
      </tr>`);
  }
  if (!rows.length) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafaff;border:1px solid #ecebf5;border-radius:10px;padding:14px 18px;margin:8px 0 20px 0;">
      ${rows.join('')}
    </table>`;
}

// Pill-style CTA button that renders with the brand gradient. Falls back gracefully in
// Outlook (which ignores gradients) to a solid blue.
function renderCta({ url, label }) {
  if (!url || !label) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;">
      <tr>
        <td style="background:#0044ff;background-image:linear-gradient(to right,#0044ff 0%,#3322cc 42%,#bb33aa 100%);border-radius:10px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
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

  const { transport, fromName, fromEmail, notifyEmail } = await getTransport();

  const start = booking.start || booking.startTime || null;
  const end = booking.end || booking.endTime || null;
  const meetingUrl = booking.meetingUrl || booking.location || null;
  const reschedule = booking.rescheduleUid
    ? `https://cal.com/reschedule/${booking.rescheduleUid}`
    : (booking.uid ? `https://cal.com/booking/${booking.uid}` : null);

  const startPretty = formatStartTime(start, timezone);
  const durationMin = (end && start) ? Math.round((new Date(end) - new Date(start)) / 60000) : null;

  // Subject — short and skimmable in an inbox preview.
  const dayShort = startPretty ? startPretty.split(',')[0] : '';
  const subject = startPretty
    ? `Your call with ${fromName} is confirmed — ${dayShort}`
    : `Your call with ${fromName} is confirmed`;

  // Plain-text alternative — kept for clients that don't render HTML and for deliverability.
  const text = [
    `Hi ${lead.name},`,
    '',
    `Thanks for booking a call with ${fromName}. Your discovery call is confirmed:`,
    '',
    startPretty ? `When:     ${startPretty}` : null,
    durationMin ? `Duration: ${durationMin} minutes` : null,
    meetingUrl ? `Where:    ${meetingUrl}` : null,
    '',
    reschedule ? `Need to reschedule? ${reschedule}` : null,
    '',
    `If anything comes up before then, just reply to this email — we'll be in touch.`,
    '',
    `— ${fromName}`,
  ].filter(Boolean).join('\n');

  const innerHtml = `
    <h1 style="margin:0 0 14px 0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#001192;">
      You're booked. ✓
    </h1>
    <p style="margin:0 0 16px 0;">
      Hi ${escapeHtml(lead.name)}, thanks for booking a call with us. Here's everything you need:
    </p>
    ${renderDetailsBox({ startPretty, durationMin, meetingUrl })}
    ${meetingUrl ? renderCta({ url: meetingUrl, label: 'Join meeting' }) : ''}
    ${reschedule ? `
      <p style="margin:0 0 16px 0;font-size:14px;color:#6b6580;">
        Need to reschedule?
        <a href="${escapeHtml(reschedule)}" style="color:#52379f;text-decoration:underline;">Pick a new time</a>.
      </p>` : ''}
    <p style="margin:20px 0 0 0;font-size:14px;color:#6b6580;">
      If anything comes up before then, just reply to this email — we'll be in touch.
    </p>
  `;

  const html = renderEmailLayout({
    preheader: startPretty ? `Your discovery call is confirmed for ${startPretty}.` : 'Your discovery call is confirmed.',
    innerHtml,
  });

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: lead.email,
    cc: notifyEmail || undefined,
    replyTo: notifyEmail || fromEmail,
    subject,
    text,
    html,
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
  const durationMin = (end && start) ? Math.round((new Date(end) - new Date(start)) / 60000) : null;

  // How long until the call (rounded to nearest minute) — drives the subject line wording
  // for both the 2h-ahead case and the "we just booked you in <30min" edge case.
  let minutesUntil = null;
  if (start) {
    minutesUntil = Math.max(0, Math.round((new Date(start).getTime() - Date.now()) / 60000));
  }
  const isStartingNow = minutesUntil != null && minutesUntil <= 5;
  const subject = isStartingNow
    ? `Your call with ${fromName} is starting now`
    : minutesUntil != null && minutesUntil < 120
    ? `Reminder: your call with ${fromName} starts in ${minutesUntil} min`
    : `Reminder: your call with ${fromName} starts in 2 hours`;

  const text = [
    `Hi ${lead.name},`,
    '',
    isStartingNow
      ? `Your discovery call with ${fromName} is starting now:`
      : `Quick reminder — your discovery call with ${fromName} is coming up:`,
    '',
    startPretty ? `When:     ${startPretty}` : null,
    durationMin ? `Duration: ${durationMin} minutes` : null,
    meetingUrl ? `Where:    ${meetingUrl}` : null,
    '',
    `We recommend joining a couple of minutes early to test your audio.`,
    reschedule ? `Need to reschedule? ${reschedule}` : null,
    '',
    `If something has come up, just reply to this email and we'll work it out.`,
    '',
    `— ${fromName}`,
  ].filter(Boolean).join('\n');

  const heading = isStartingNow
    ? 'Your call is starting now.'
    : (minutesUntil != null && minutesUntil < 120)
      ? `Your call starts in ${minutesUntil} minutes.`
      : 'Your call starts in 2 hours.';

  const innerHtml = `
    <h1 style="margin:0 0 14px 0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#001192;">
      ${escapeHtml(heading)}
    </h1>
    <p style="margin:0 0 16px 0;">
      Hi ${escapeHtml(lead.name)}, quick reminder so you don't miss it:
    </p>
    ${renderDetailsBox({ startPretty, durationMin, meetingUrl })}
    ${meetingUrl ? renderCta({ url: meetingUrl, label: isStartingNow ? 'Join now' : 'Join meeting' }) : ''}
    <p style="margin:0 0 12px 0;font-size:14px;color:#6b6580;">
      We recommend joining a couple of minutes early to test your audio.
    </p>
    ${reschedule ? `
      <p style="margin:0 0 16px 0;font-size:14px;color:#6b6580;">
        Need to reschedule?
        <a href="${escapeHtml(reschedule)}" style="color:#52379f;text-decoration:underline;">Pick a new time</a>.
      </p>` : ''}
    <p style="margin:20px 0 0 0;font-size:14px;color:#6b6580;">
      If something has come up, just reply to this email and we'll work it out.
    </p>
  `;

  const html = renderEmailLayout({
    preheader: startPretty ? `Reminder: your call is at ${startPretty}.` : 'Reminder: your call is coming up.',
    innerHtml,
  });

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: lead.email,
    cc: notifyEmail || undefined,
    replyTo: notifyEmail || fromEmail,
    subject,
    text,
    html,
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
