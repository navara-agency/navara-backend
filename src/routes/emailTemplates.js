const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  TEMPLATE_KEYS,
  DEFAULTS,
  VARIABLE_CATALOG,
  RECIPIENT_EXTRA_VARS,
  loadTemplate,
  renderTemplate,
  seedDefaults,
} = require('../services/emailTemplates');
const { getTransport } = require('../services/email');
const logger = require('../config/logger');

const router = express.Router();

// Fake context used by the "Send test" endpoint so the rendered email looks realistic
// without exposing a real lead. Every variable in the catalog gets a sample value.
const SAMPLE_CONTEXT = {
  // lead_notification
  leadName: 'Aisha Ali',
  leadCompany: 'Acme Co',
  leadEmail: 'aisha@example.com',
  leadPhone: '+201001234567',
  leadMarket: 'Egypt',
  leadIndustry: 'Healthcare',
  leadGoal: 'Generate qualified leads',
  leadServices: 'Brand Presence, Demand Generation',
  leadBudget: '$3,000–$6,000',
  leadNote: 'Looking to ramp up Q3 — particularly interested in paid social.',
  leadId: 999,
  submittedAt: new Date().toISOString(),
  // booking_*
  visitorName: 'Aisha Ali',
  visitorEmail: 'aisha@example.com',
  companyName: 'Navara',
  meetingStart: 'Monday, May 26, 2026, 10:00 AM GMT+2',
  meetingDay: 'Monday',
  meetingDuration: 30,
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  rescheduleUrl: 'https://cal.com/reschedule/sample-uid',
  minutesUntil: 120,
};

// GET /api/email-templates — list summary of all templates (admin)
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { EmailTemplate } = require('../models');
    const rows = await EmailTemplate.findAll({ order: [['templateKey', 'ASC']] });
    const byKey = new Map(rows.map((r) => [r.templateKey, r]));
    // Always return one entry per known key, even if the DB row hasn't been created yet,
    // so the dashboard list never shows gaps after a fresh migration.
    const out = TEMPLATE_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        templateKey: key,
        subject: row?.subject ?? DEFAULTS[key].subject,
        enabled: row?.enabled ?? true,
        updatedAt: row?.updatedAt ?? null,
        fromDb: Boolean(row),
      };
    });
    return res.json({ templates: out });
  } catch (err) {
    return next(err);
  }
});

// GET /api/email-templates/:key — full template + variable catalog
router.get('/:key', requireAuth, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Unknown template key' });
    }
    const tpl = await loadTemplate(key);
    // loadTemplate returns null if the row exists but is disabled — surface the disabled
    // copy too so the editor can show it and toggle it back on.
    const { EmailTemplate } = require('../models');
    const row = await EmailTemplate.findOne({ where: { templateKey: key } });
    const subject = row?.subject ?? DEFAULTS[key].subject;
    const bodyText = row?.bodyText ?? DEFAULTS[key].bodyText;
    const bodyHtml = row?.bodyHtml ?? DEFAULTS[key].bodyHtml;
    const enabled = row?.enabled ?? true;

    return res.json({
      templateKey: key,
      subject,
      bodyText,
      bodyHtml,
      enabled,
      // Recipient + sender overrides (null = use defaults)
      toAddress: row?.toAddress ?? null,
      ccAddress: row?.ccAddress ?? null,
      bccAddress: row?.bccAddress ?? null,
      replyToAddress: row?.replyToAddress ?? null,
      fromName: row?.fromName ?? null,
      fromEmail: row?.fromEmail ?? null,
      attachments: Array.isArray(row?.attachments) ? row.attachments : [],
      updatedAt: row?.updatedAt ?? null,
      fromDb: Boolean(row),
      defaults: DEFAULTS[key],
      variables: VARIABLE_CATALOG[key] || [],
      recipientVariables: RECIPIENT_EXTRA_VARS,
      htmlSupported: DEFAULTS[key].bodyHtml != null,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/email-templates/:key — update subject/body/enabled
router.put('/:key', requireAuth, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Unknown template key' });
    }
    const body = req.body || {};
    const subject = typeof body.subject === 'string' ? body.subject : null;
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText : null;
    // bodyHtml allowed to be string OR explicit null (for plain-text-only templates).
    // Reject any other type so we don't accidentally persist an object.
    let bodyHtml;
    if (body.bodyHtml === null) bodyHtml = null;
    else if (typeof body.bodyHtml === 'string') bodyHtml = body.bodyHtml;
    else bodyHtml = undefined;
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;

    // Recipient + sender overrides: accept string (set) OR null (clear) OR undefined (no
    // change). Empty strings are normalised to null so the send pipeline falls back to defaults.
    const nullableString = (v) => {
      if (v === null) return null;
      if (typeof v !== 'string') return undefined;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    };
    const toAddress = nullableString(body.toAddress);
    const ccAddress = nullableString(body.ccAddress);
    const bccAddress = nullableString(body.bccAddress);
    const replyToAddress = nullableString(body.replyToAddress);
    const fromName = nullableString(body.fromName);
    const fromEmail = nullableString(body.fromEmail);

    // Attachments: validated array of objects with { filename, url } at minimum. We don't
    // re-validate URLs are reachable here — that happens at send time.
    let attachments;
    if (body.attachments === null) {
      attachments = [];
    } else if (Array.isArray(body.attachments)) {
      attachments = body.attachments
        .filter((a) => a && typeof a === 'object' && typeof a.url === 'string')
        .map((a) => ({
          filename: typeof a.filename === 'string' ? a.filename : 'attachment',
          url: a.url,
          publicId: typeof a.publicId === 'string' ? a.publicId : null,
          contentType: typeof a.contentType === 'string' ? a.contentType : null,
          sizeBytes: typeof a.sizeBytes === 'number' ? a.sizeBytes : null,
        }));
    } else {
      attachments = undefined;
    }

    if (subject == null || bodyText == null) {
      return res.status(400).json({ error: 'subject and bodyText are required' });
    }
    if (subject.length === 0 || subject.length > 500) {
      return res.status(400).json({ error: 'subject must be 1–500 characters' });
    }

    const { EmailTemplate } = require('../models');
    let row = await EmailTemplate.findOne({ where: { templateKey: key } });
    if (row) {
      row.subject = subject;
      row.bodyText = bodyText;
      if (bodyHtml !== undefined) row.bodyHtml = bodyHtml;
      if (enabled !== undefined) row.enabled = enabled;
      if (toAddress !== undefined) row.toAddress = toAddress;
      if (ccAddress !== undefined) row.ccAddress = ccAddress;
      if (bccAddress !== undefined) row.bccAddress = bccAddress;
      if (replyToAddress !== undefined) row.replyToAddress = replyToAddress;
      if (fromName !== undefined) row.fromName = fromName;
      if (fromEmail !== undefined) row.fromEmail = fromEmail;
      if (attachments !== undefined) row.attachments = attachments;
      await row.save();
    } else {
      row = await EmailTemplate.create({
        templateKey: key,
        subject,
        bodyText,
        bodyHtml: bodyHtml ?? DEFAULTS[key].bodyHtml,
        enabled: enabled ?? true,
        toAddress: toAddress ?? null,
        ccAddress: ccAddress ?? null,
        bccAddress: bccAddress ?? null,
        replyToAddress: replyToAddress ?? null,
        fromName: fromName ?? null,
        fromEmail: fromEmail ?? null,
        attachments: attachments ?? [],
      });
    }
    return res.json({
      templateKey: key,
      subject: row.subject,
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      toAddress: row.toAddress,
      ccAddress: row.ccAddress,
      bccAddress: row.bccAddress,
      replyToAddress: row.replyToAddress,
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      attachments: row.attachments || [],
      enabled: row.enabled,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/email-templates/:key/reset — restore the canonical default
router.post('/:key/reset', requireAuth, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Unknown template key' });
    }
    const { EmailTemplate } = require('../models');
    const def = DEFAULTS[key];
    let row = await EmailTemplate.findOne({ where: { templateKey: key } });
    if (row) {
      row.subject = def.subject;
      row.bodyText = def.bodyText;
      row.bodyHtml = def.bodyHtml;
      row.enabled = true;
      await row.save();
    } else {
      row = await EmailTemplate.create({
        templateKey: key,
        subject: def.subject,
        bodyText: def.bodyText,
        bodyHtml: def.bodyHtml,
        enabled: true,
      });
    }
    return res.json({
      templateKey: key,
      subject: row.subject,
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      enabled: row.enabled,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/email-templates/:key/test — render with sample data and send to notifyEmail
router.post('/:key/test', requireAuth, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Unknown template key' });
    }
    const rendered = await renderTemplate(key, SAMPLE_CONTEXT, {
      preheader: '[TEST] Sample render of the template.',
    });
    if (!rendered) {
      return res.status(400).json({ error: 'Template is disabled' });
    }
    const { transport, fromName, fromEmail, notifyEmail } = await getTransport();
    if (!notifyEmail) {
      return res.status(400).json({ error: 'notifyEmail not configured — set NOTIFY_EMAIL or update Email Config' });
    }
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: notifyEmail,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      ...(rendered.html ? { html: rendered.html } : {}),
    });
    return res.json({ ok: true, sentTo: notifyEmail });
  } catch (err) {
    logger.warn({ err: err.message }, 'email template test send failed');
    return next(err);
  }
});

// POST /api/email-templates/seed — bulk-create missing rows from defaults. Idempotent.
// Useful right after a fresh migration to populate the table without going through the UI.
router.post('/seed', requireAuth, async (_req, res, next) => {
  try {
    const results = await seedDefaults({ force: false });
    return res.json({ ok: true, results });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
