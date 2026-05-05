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

function createApp() {
  const app = express();

  // R14 — trust the proxy chain so req.ip reflects the real visitor IP, not the
  // load-balancer's. Hostinger Cloud has 2+ hops (edge → LB → container), so trusting
  // only `1` strips the X-Forwarded-For header before we can read it. Trusting `true`
  // walks the whole chain. Trade-off: X-Forwarded-For becomes spoofable, which is
  // acceptable for a marketing-site backend (no IP-based admin auth).
  app.set('trust proxy', true);

  app.use(express.json({ limit: '1mb' }));
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

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

  app.use((req, res, _next) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use(errorHandler);

  app.locals.logger = logger;
  return app;
}

module.exports = { createApp };
