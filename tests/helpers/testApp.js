/**
 * Builds an isolated Express app instance backed by a fresh sqlite-in-memory database
 * for use across contract and integration tests. Truncate between tests via truncateAll().
 */
const { sequelize } = require('../../src/config/db');
require('../../src/models');

let appInstance;

async function buildTestApp() {
  if (!appInstance) {
    await sequelize.sync({ force: true });
    await seedSingletons();
    const { createApp } = require('../../src/app');
    appInstance = createApp();
  }
  return appInstance;
}

async function seedSingletons() {
  const { SiteConfig, EmailConfig } = require('../../src/models');
  await SiteConfig.upsert({
    id: 1,
    egPhone: '+20 100 000 0000',
    egWhatsapp: '+20 100 000 0000',
    egOffice: 'Cairo, Egypt',
    egHours: 'Sun–Thu, 9am–6pm EET',
    egCtaSubtext: 'Serving Egypt',
    egCalLink: 'omarelsady/discovery-call-eg',
    ksaPhone: '+966 50 000 0000',
    ksaWhatsapp: '+966 50 000 0000',
    ksaOffice: 'Riyadh, KSA',
    ksaHours: 'Sun–Thu, 9am–6pm AST',
    ksaCtaSubtext: 'Serving KSA',
    ksaCalLink: 'omarelsady/discovery-call-ksa',
    linkedinUrl: 'https://linkedin.com/company/navara',
    instagramUrl: 'https://instagram.com/navara',
    emailContact: 'hello@navara.com',
    metaTitle: 'Navara',
    metaDescription: 'Marketing agency for Egypt and KSA',
  });
  await EmailConfig.upsert({
    id: 1,
    smtpHost: 'smtp.example.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'test@example.com',
    smtpPass: 'test-pass',
    fromName: 'Navara',
    fromEmail: 'test@example.com',
    notifyEmail: 'admin@example.com',
  });
}

async function truncateAll() {
  const models = require('../../src/models');
  // Order matters less here since there are no FKs — but reset all tables
  const truncatable = ['Lead', 'BookingReminder', 'CaseStudy', 'Testimonial', 'Logo', 'FaqItem', 'Translation', 'EmailTemplate', 'AdminUser'];
  for (const name of truncatable) {
    if (models[name]) await models[name].destroy({ where: {}, truncate: true });
  }
  // Reset singletons to seed defaults
  await seedSingletons();
}

async function closeApp() {
  await sequelize.close();
  appInstance = null;
}

module.exports = { buildTestApp, truncateAll, closeApp, seedSingletons };
