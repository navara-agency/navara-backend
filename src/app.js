const express = require('express');
const cors = require('cors');

const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./config/logger');

const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const geoRoutes = require('./routes/geo');
const caseStudiesRoutes = require('./routes/caseStudies');
const testimonialsRoutes = require('./routes/testimonials');
const logosRoutes = require('./routes/logos');
const faqRoutes = require('./routes/faq');
const siteConfigRoutes = require('./routes/siteConfig');
const emailConfigRoutes = require('./routes/emailConfig');
const translationsRoutes = require('./routes/translations');
const uploadRoutes = require('./routes/upload');
const calcomRoutes = require('./routes/calcom');
const emailTemplatesRoutes = require('./routes/emailTemplates');

function createApp() {
  const app = express();

  // R14 — trust the proxy chain so req.ip reflects the real visitor IP, not the
  // load-balancer's. Hostinger Cloud has 2+ hops (edge → LB → container), so trusting
  // only `1` strips the X-Forwarded-For header before we can read it. Trusting `true`
  // walks the whole chain. Trade-off: X-Forwarded-For becomes spoofable, which is
  // acceptable for a marketing-site backend (no IP-based admin auth).
  app.set('trust proxy', true);

  // CORS first, before the body parser. If the body parser rejects an oversize payload
  // it short-circuits with a 413 — and unless CORS already ran, the browser sees the
  // 413 as a CORS error because the response is missing Access-Control-Allow-Origin.
  // Allow comma-separated multiple origins so navaraagency.com + www. + custom domains
  // can all be whitelisted via one env var.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',').map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / curl / server-to-server (no Origin header)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Translation trees are large JSON blobs (~30-40 KB per language but can grow).
  // Bumped from 1mb to 5mb so PUT /api/translations/:lang works for full-tree saves.
  app.use(express.json({ limit: '5mb' }));

  // Health check — pings DB and reports which integrations have credentials configured.
  // Useful for uptime monitoring and post-deploy smoke checks. Never reveals secret values.
  app.get('/api/health', async (_req, res) => {
    const { sequelize } = require('./config/db');
    let db = 'unknown';
    try {
      await sequelize.authenticate();
      db = 'ok';
    } catch (err) {
      db = `error: ${err.message}`;
    }
    res.json({
      ok: db === 'ok',
      db,
      env: process.env.NODE_ENV || 'development',
      integrations: {
        cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
        cal: Boolean(process.env.CAL_API_KEY && (process.env.CAL_EVENT_TYPE_ID || process.env.CAL_EVENT_TYPE_ID_EGYPT || process.env.CAL_EVENT_TYPE_ID_KSA)),
      },
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api/case-studies', caseStudiesRoutes);
  app.use('/api/testimonials', testimonialsRoutes);
  app.use('/api/logos', logosRoutes);
  app.use('/api/faq', faqRoutes);
  app.use('/api/site-config', siteConfigRoutes);
  app.use('/api/email-config', emailConfigRoutes);
  app.use('/api/translations', translationsRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/calcom', calcomRoutes);
  app.use('/api/email-templates', emailTemplatesRoutes);

  app.use((req, res, _next) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use(errorHandler);

  app.locals.logger = logger;
  return app;
}

module.exports = { createApp };
