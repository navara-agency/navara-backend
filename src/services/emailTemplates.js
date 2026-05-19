const logger = require('../config/logger');

// ─── HTML helpers ────────────────────────────────────────────────────────────────

// Strings authored by admins are stored raw; values substituted into `{{vars}}` are
// HTML-escaped when rendered into HTML so a malicious lead.name can't break the layout
// or inject a script tag. Plain-text rendering leaves values as-is.
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
 * Substitute every `{{key}}` in `tpl` with `vars[key]`. Whitespace inside the braces
 * is tolerated (`{{ key }}`). Unknown keys are replaced with empty string so a typo or
 * missing field doesn't print "{{visitorName}}" in a live email.
 *
 * @param {string} tpl
 * @param {object} vars     Map of placeholder → raw string value
 * @param {boolean} escape  If true, HTML-escape each substituted value
 */
function substitute(tpl, vars, { escape = false } = {}) {
  if (typeof tpl !== 'string') return '';
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const raw = vars[key];
    const value = raw == null ? '' : String(raw);
    return escape ? escapeHtml(value) : value;
  });
}

// ─── Shared layout (admins don't edit this) ──────────────────────────────────────

const BRAND_SITE = 'https://navaraagency.com';
const BRAND_LOGO = `${BRAND_SITE}/nv-icon-192.png`;

/**
 * Wraps inner HTML in the shared Navara email layout: top gradient bar, logo, card body,
 * footer. Table-based + inline styles so it renders across Gmail / Outlook / Apple Mail.
 */
function wrapInLayout({ preheader, innerHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Navara</title>
</head>
<body style="margin:0;padding:0;background:#f5f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1235;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader || '')}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f4fa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(82,55,159,0.08);">
          <tr><td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(to right,#0044ff 0%,#3322cc 42%,#bb33aa 100%);">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;"><img src="${BRAND_LOGO}" alt="Navara" width="36" height="36" style="display:block;border-radius:8px;"></td>
                  <td style="vertical-align:middle;padding-left:12px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#001192;">Navara</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:24px 32px 32px 32px;font-size:15px;line-height:1.6;color:#1a1235;">${innerHtml}</td></tr>
          <tr><td style="background:#fafaff;border-top:1px solid #ecebf5;padding:18px 32px;font-size:12px;color:#8e89a8;text-align:center;">
            Navara — integrated growth partner™<br>
            <a href="${BRAND_SITE}" style="color:#52379f;text-decoration:none;">navaraagency.com</a>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Variable catalog (what admins can put in `{{vars}}`) ────────────────────────

// Per-template documentation surfaced in the dashboard editor so admins know what they
// can reference. `name` is the placeholder string; `description` is help text.
const VARIABLE_CATALOG = {
  lead_notification: [
    { name: 'leadName',      description: 'Visitor full name' },
    { name: 'leadCompany',   description: 'Visitor company / business name' },
    { name: 'leadEmail',     description: 'Visitor email' },
    { name: 'leadPhone',     description: 'Visitor WhatsApp number (E.164)' },
    { name: 'leadMarket',    description: 'Egypt / KSA / Other (derived from phone)' },
    { name: 'leadIndustry',  description: 'Industry the visitor picked' },
    { name: 'leadGoal',      description: 'Primary goal the visitor picked' },
    { name: 'leadServices',  description: 'Services the visitor selected (comma-separated)' },
    { name: 'leadBudget',    description: 'Monthly budget range' },
    { name: 'leadNote',      description: 'Free-text note from the visitor' },
    { name: 'leadId',        description: 'Internal lead ID number' },
    { name: 'submittedAt',   description: 'ISO timestamp of submission' },
  ],
  booking_confirmation: [
    { name: 'visitorName',     description: 'Visitor full name' },
    { name: 'visitorEmail',    description: 'Visitor email' },
    { name: 'companyName',     description: 'Brand name (e.g. Navara)' },
    { name: 'meetingStart',    description: 'Date + time + timezone of the call (formatted)' },
    { name: 'meetingDay',      description: 'Just the weekday + date, no time' },
    { name: 'meetingDuration', description: 'Duration in minutes' },
    { name: 'meetingUrl',      description: 'Google Meet (or Cal.com) join link' },
    { name: 'rescheduleUrl',   description: 'Cal.com reschedule link' },
  ],
  booking_reminder: [
    { name: 'visitorName',     description: 'Visitor full name' },
    { name: 'visitorEmail',    description: 'Visitor email' },
    { name: 'companyName',     description: 'Brand name (e.g. Navara)' },
    { name: 'meetingStart',    description: 'Date + time + timezone of the call (formatted)' },
    { name: 'meetingDay',      description: 'Just the weekday + date, no time' },
    { name: 'meetingDuration', description: 'Duration in minutes' },
    { name: 'meetingUrl',      description: 'Google Meet (or Cal.com) join link' },
    { name: 'rescheduleUrl',   description: 'Cal.com reschedule link' },
    { name: 'minutesUntil',    description: 'Minutes until the meeting starts' },
  ],
};

// ─── Default templates (used as fallback + DB seed) ──────────────────────────────

const DEFAULTS = {
  lead_notification: {
    subject: 'New Lead: {{leadName}} from {{leadCompany}} ({{leadMarket}})',
    bodyText: [
      'Name:     {{leadName}}',
      'Company:  {{leadCompany}}',
      'Market:   {{leadMarket}}',
      'Industry: {{leadIndustry}}',
      'Goal:     {{leadGoal}}',
      'Services: {{leadServices}}',
      'Budget:   {{leadBudget}}',
      'Phone:    {{leadPhone}}',
      'Email:    {{leadEmail}}',
      '',
      'Note:',
      '{{leadNote}}',
      '',
      'Submitted at: {{submittedAt}}',
      'Lead ID: {{leadId}}',
    ].join('\n'),
    bodyHtml: null,
  },
  booking_confirmation: {
    subject: "Your call with {{companyName}} is confirmed — {{meetingDay}}",
    bodyText: [
      'Hi {{visitorName}},',
      '',
      "Thanks for booking a call with {{companyName}}. Your discovery call is confirmed:",
      '',
      'When:     {{meetingStart}}',
      'Duration: {{meetingDuration}} minutes',
      'Where:    {{meetingUrl}}',
      '',
      'Need to reschedule? {{rescheduleUrl}}',
      '',
      "If anything comes up before then, just reply to this email — we'll be in touch.",
      '',
      '— {{companyName}}',
    ].join('\n'),
    bodyHtml: `
<h1 style="margin:0 0 14px 0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#001192;">
  You're booked. ✓
</h1>
<p style="margin:0 0 16px 0;">
  Hi {{visitorName}}, thanks for booking a call with us. Here's everything you need:
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafaff;border:1px solid #ecebf5;border-radius:10px;padding:14px 18px;margin:8px 0 20px 0;">
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;width:90px;">When</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">{{meetingStart}}</td></tr>
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;">Duration</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">{{meetingDuration}} minutes</td></tr>
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;">Where</td><td style="padding:6px 0;font-size:14px;"><a href="{{meetingUrl}}" style="color:#0044ff;text-decoration:none;word-break:break-all;">{{meetingUrl}}</a></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;">
  <tr><td style="background:#0044ff;background-image:linear-gradient(to right,#0044ff 0%,#3322cc 42%,#bb33aa 100%);border-radius:10px;">
    <a href="{{meetingUrl}}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Join meeting</a>
  </td></tr>
</table>
<p style="margin:0 0 16px 0;font-size:14px;color:#6b6580;">
  Need to reschedule? <a href="{{rescheduleUrl}}" style="color:#52379f;text-decoration:underline;">Pick a new time</a>.
</p>
<p style="margin:20px 0 0 0;font-size:14px;color:#6b6580;">
  If anything comes up before then, just reply to this email — we'll be in touch.
</p>`.trim(),
  },
  booking_reminder: {
    subject: 'Reminder: your call with {{companyName}} starts in {{minutesUntil}} min',
    bodyText: [
      'Hi {{visitorName}},',
      '',
      'Quick reminder — your discovery call with {{companyName}} is coming up:',
      '',
      'When:     {{meetingStart}}',
      'Duration: {{meetingDuration}} minutes',
      'Where:    {{meetingUrl}}',
      '',
      'We recommend joining a couple of minutes early to test your audio.',
      'Need to reschedule? {{rescheduleUrl}}',
      '',
      "If something has come up, just reply to this email and we'll work it out.",
      '',
      '— {{companyName}}',
    ].join('\n'),
    bodyHtml: `
<h1 style="margin:0 0 14px 0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#001192;">
  Your call starts in {{minutesUntil}} minutes.
</h1>
<p style="margin:0 0 16px 0;">
  Hi {{visitorName}}, quick reminder so you don't miss it:
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafaff;border:1px solid #ecebf5;border-radius:10px;padding:14px 18px;margin:8px 0 20px 0;">
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;width:90px;">When</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">{{meetingStart}}</td></tr>
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;">Duration</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1235;">{{meetingDuration}} minutes</td></tr>
  <tr><td style="padding:6px 0;font-size:14px;color:#6b6580;">Where</td><td style="padding:6px 0;font-size:14px;"><a href="{{meetingUrl}}" style="color:#0044ff;text-decoration:none;word-break:break-all;">{{meetingUrl}}</a></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;">
  <tr><td style="background:#0044ff;background-image:linear-gradient(to right,#0044ff 0%,#3322cc 42%,#bb33aa 100%);border-radius:10px;">
    <a href="{{meetingUrl}}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Join meeting</a>
  </td></tr>
</table>
<p style="margin:0 0 12px 0;font-size:14px;color:#6b6580;">
  We recommend joining a couple of minutes early to test your audio.
</p>
<p style="margin:0 0 16px 0;font-size:14px;color:#6b6580;">
  Need to reschedule? <a href="{{rescheduleUrl}}" style="color:#52379f;text-decoration:underline;">Pick a new time</a>.
</p>
<p style="margin:20px 0 0 0;font-size:14px;color:#6b6580;">
  If something has come up, just reply to this email and we'll work it out.
</p>`.trim(),
  },
};

const TEMPLATE_KEYS = Object.keys(DEFAULTS);

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Read a template from the DB. If the row doesn't exist (e.g. fresh deploy), fall back
 * to the in-code default. If the row exists but is disabled, return null.
 */
async function loadTemplate(templateKey) {
  if (!DEFAULTS[templateKey]) {
    throw new Error(`Unknown template key: ${templateKey}`);
  }
  try {
    const { EmailTemplate } = require('../models');
    const row = await EmailTemplate.findOne({ where: { templateKey } });
    if (!row) return { ...DEFAULTS[templateKey], enabled: true, fromDb: false };
    if (!row.enabled) return null;
    return {
      subject: row.subject,
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      enabled: row.enabled,
      fromDb: true,
    };
  } catch (err) {
    // DB unreachable shouldn't kill an email — log + fall back to defaults.
    logger.warn({ err: err.message, templateKey }, 'email template DB read failed; using default');
    return { ...DEFAULTS[templateKey], enabled: true, fromDb: false };
  }
}

/**
 * Render a template against a context object. Returns { subject, text, html } where
 * html is wrapped in the shared layout. If the template is disabled, returns null.
 *
 * @param {string} templateKey  one of TEMPLATE_KEYS
 * @param {object} vars         placeholder values
 * @param {object} [opts]
 * @param {string} [opts.preheader]  Optional preheader text for inbox previews
 */
async function renderTemplate(templateKey, vars, opts = {}) {
  const tpl = await loadTemplate(templateKey);
  if (!tpl) return null;

  const subject = substitute(tpl.subject, vars, { escape: false });
  const text = substitute(tpl.bodyText, vars, { escape: false });
  let html = null;
  if (tpl.bodyHtml) {
    const innerHtml = substitute(tpl.bodyHtml, vars, { escape: true });
    html = wrapInLayout({ preheader: opts.preheader, innerHtml });
  }
  return { subject, text, html };
}

// Used by the seeder + admin "reset" route to (re)create the canonical default rows.
async function seedDefaults({ force = false } = {}) {
  const { EmailTemplate } = require('../models');
  const results = [];
  for (const key of TEMPLATE_KEYS) {
    const existing = await EmailTemplate.findOne({ where: { templateKey: key } });
    if (existing && !force) {
      results.push({ key, action: 'skipped' });
      continue;
    }
    const def = DEFAULTS[key];
    if (existing) {
      existing.subject = def.subject;
      existing.bodyText = def.bodyText;
      existing.bodyHtml = def.bodyHtml;
      existing.enabled = true;
      await existing.save();
      results.push({ key, action: 'reset' });
    } else {
      await EmailTemplate.create({
        templateKey: key,
        subject: def.subject,
        bodyText: def.bodyText,
        bodyHtml: def.bodyHtml,
        enabled: true,
      });
      results.push({ key, action: 'created' });
    }
  }
  return results;
}

module.exports = {
  TEMPLATE_KEYS,
  DEFAULTS,
  VARIABLE_CATALOG,
  loadTemplate,
  renderTemplate,
  seedDefaults,
  substitute,
  escapeHtml,
};
