#!/usr/bin/env node
/**
 * Idempotent seed script — populates fixtures from frontend mocks.
 * Run AFTER `npx sequelize-cli db:migrate`.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const { sequelize } = require('../config/db');
const logger = require('../config/logger');
require('../models');

// Try the mono-repo layout first (frontend/ as a sibling of backend/); fall back to the
// bundled copies inside this repo (used after we split the project into separate repos).
const MONO_FRONTEND_ROOT = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src');
const MOCK_PATH_MONO = path.join(MONO_FRONTEND_ROOT, 'data', 'mockDashboard.js');
const EN_PATH_MONO = path.join(MONO_FRONTEND_ROOT, 'locales', 'en.json');
const AR_PATH_MONO = path.join(MONO_FRONTEND_ROOT, 'locales', 'ar.json');

const BUNDLED_LOCALES = path.join(__dirname, 'locales');
const EN_PATH_BUNDLED = path.join(BUNDLED_LOCALES, 'en.json');
const AR_PATH_BUNDLED = path.join(BUNDLED_LOCALES, 'ar.json');

const MOCK_PATH = fs.existsSync(MOCK_PATH_MONO) ? MOCK_PATH_MONO : null;
const EN_PATH = fs.existsSync(EN_PATH_MONO) ? EN_PATH_MONO : EN_PATH_BUNDLED;
const AR_PATH = fs.existsSync(AR_PATH_MONO) ? AR_PATH_MONO : AR_PATH_BUNDLED;

async function loadMocks() {
  // mockDashboard.js only exists in the mono-repo; in the standalone backend, return empty
  // and let the admin populate FAQ / testimonials / etc. via the dashboard.
  if (!MOCK_PATH) {
    logger.info('seed: mockDashboard.js not found — skipping FAQ/testimonials/cases/logos seed (admin populates via dashboard)');
    return {};
  }
  const url = pathToFileURL(MOCK_PATH).href;
  return await import(url);
}

function loadJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function seedSiteConfig(mock) {
  const { SiteConfig } = require('../models');
  const sc = mock.SITE_CONFIG || {};
  await SiteConfig.upsert({
    id: 1,
    linkedinUrl: sc.linkedinUrl || null,
    instagramUrl: sc.instagramUrl || null,
    emailContact: sc.emailContact || null,
    metaTitle: sc.metaTitle || null,
    metaDescription: sc.metaDescription || null,
    egPhone: sc.whatsapp || null,
    egWhatsapp: sc.whatsapp || null,
    egOffice: sc.officeEgypt || 'Cairo, Egypt',
    egHours: sc.workingHours || 'Sun–Thu, 9am–6pm EET',
    egCtaSubtext: 'Serving Egypt',
    egCalLink: sc.calLink || null,
    ksaOffice: sc.officeKSA || 'Riyadh, KSA',
    ksaHours: 'Sun–Thu, 9am–6pm AST',
    ksaCtaSubtext: 'Serving KSA',
    ksaCalLink: null,
  });
  logger.info('seed: site_config upserted');
}

async function seedEmailConfig() {
  const { EmailConfig } = require('../models');
  await EmailConfig.upsert({
    id: 1,
    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpSecure: process.env.SMTP_SECURE === 'false' ? false : true,
    smtpUser: process.env.SMTP_USER || null,
    smtpPass: process.env.SMTP_PASS || null,
    fromName: 'Navara',
    fromEmail: process.env.SMTP_USER || null,
    notifyEmail: process.env.NOTIFY_EMAIL || null,
  });
  logger.info('seed: email_config upserted');
}

async function seedFaq(mock) {
  const { FaqItem } = require('../models');
  const items = mock.FAQ_ITEMS || [];
  for (const [i, item] of items.entries()) {
    await FaqItem.upsert({
      id: item.id || i + 1,
      questionEn: item.questionEn || item.question_en || item.question || '',
      answerEn: item.answerEn || item.answer_en || item.answer || '',
      questionAr: item.questionAr || item.question_ar || item.questionEn || '',
      answerAr: item.answerAr || item.answer_ar || item.answerEn || '',
      enabled: item.enabled !== false,
      sortOrder: item.sortOrder ?? item.sort_order ?? i,
    });
  }
  logger.info(`seed: ${items.length} faq_items upserted`);
}

async function seedTestimonials(mock) {
  const { Testimonial } = require('../models');
  const items = mock.TESTIMONIALS || [];
  for (const [i, t] of items.entries()) {
    await Testimonial.upsert({
      id: t.id || i + 1,
      quote: t.quote || '',
      author: t.author || t.name || '',
      title: t.title || null,
      company: t.company || null,
      industry: t.industry || null,
      rating: t.rating || 5,
      resultsBadge: t.resultsBadge || t.badge || null,
      status: t.status || 'published',
      sortOrder: t.sortOrder ?? i,
    });
  }
  logger.info(`seed: ${items.length} testimonials upserted`);
}

async function seedCaseStudies(mock) {
  const { CaseStudy } = require('../models');
  const items = mock.CASE_STUDIES || [];
  for (const [i, c] of items.entries()) {
    await CaseStudy.upsert({
      id: c.id || i + 1,
      client: c.client || '',
      title: c.title || '',
      industry: c.industry || '',
      market: c.market || null,
      services: Array.isArray(c.services) ? c.services : null,
      challenge: c.challenge || null,
      outcome: c.outcome || null,
      accentColor: c.accentColor || '#FB6107',
      slug: c.slug || `case-${i + 1}`,
      status: c.status || 'published',
      sortOrder: c.sortOrder ?? i,
    });
  }
  logger.info(`seed: ${items.length} case_studies upserted`);
}

async function seedLogos(mock) {
  const { Logo } = require('../models');
  const items = mock.LOGOS || [];
  for (const [i, l] of items.entries()) {
    await Logo.upsert({
      id: l.id || i + 1,
      name: l.name || '',
      type: l.type || 'client',
      image: l.image || l.url || null,
      url: l.url || null,
      sortOrder: l.sortOrder ?? i,
    });
  }
  logger.info(`seed: ${items.length} logos upserted`);
}

async function seedTranslations() {
  const { Translation } = require('../models');
  const en = loadJson(EN_PATH);
  const ar = loadJson(AR_PATH);

  if (en) {
    const [row] = await Translation.findOrCreate({ where: { lang: 'en' }, defaults: { lang: 'en', keysJson: en } });
    if (row.keysJson !== en) {
      row.keysJson = en;
      await row.save();
    }
    logger.info('seed: translations.en upserted');
  } else {
    logger.warn('seed: en.json not found — skipping');
  }

  if (ar) {
    const [row] = await Translation.findOrCreate({ where: { lang: 'ar' }, defaults: { lang: 'ar', keysJson: ar } });
    if (row.keysJson !== ar) {
      row.keysJson = ar;
      await row.save();
    }
    logger.info('seed: translations.ar upserted');
  } else {
    logger.warn('seed: ar.json not found — skipping');
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    const mock = await loadMocks();
    await seedSiteConfig(mock);
    await seedEmailConfig();
    await seedFaq(mock);
    await seedTestimonials(mock);
    await seedCaseStudies(mock);
    await seedLogos(mock);
    await seedTranslations();
    logger.info('seed: complete');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'seed: failed');
    process.exit(1);
  }
}

main();
