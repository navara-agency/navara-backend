#!/usr/bin/env node
/**
 * Generates a single SQL dump that recreates the entire schema (8 tables, indexes,
 * SequelizeMeta tracking) plus the singleton site_config / email_config rows and the
 * en/ar translation rows. Importing this in phpMyAdmin replaces running migrations + seed.
 *
 * Run: node src/scripts/generate-sql-dump.js > navara-bootstrap.sql
 */
const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'ar.json'), 'utf8'));

function sqlEscape(jsonString) {
  // MySQL string literal — escape backslashes first, then single quotes
  return jsonString.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const enJson = sqlEscape(JSON.stringify(en));
const arJson = sqlEscape(JSON.stringify(ar));

const sql = `-- ─────────────────────────────────────────────────────────────────────────────
-- Navara — bootstrap SQL dump
-- Generated: ${new Date().toISOString()}
--
-- Imports cleanly in phpMyAdmin (Import tab) or any MySQL client. Replaces
-- running \`npm run migrate && npm run seed\` for first-time database setup.
--
-- Includes:
--  * 8 tables (leads, case_studies, testimonials, logos, faq_items,
--             site_config, email_config, translations)
--  * SequelizeMeta tracking row for each migration so future
--    \`npm run migrate\` calls don't try to re-run them
--  * Singleton rows for site_config and email_config (id = 1)
--  * en / ar translation rows from the bundled locale JSONs
--
-- Safe to re-run on an empty database. NOT safe to re-run on a populated one
-- without truncating first (the CREATE TABLE statements use IF NOT EXISTS but
-- the INSERTs are not idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ──────────────────────────────────────── leads
CREATE TABLE IF NOT EXISTS \`leads\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(255) NOT NULL,
  \`company\` VARCHAR(255) NOT NULL,
  \`market\` ENUM('Egypt','KSA','Other') NOT NULL,
  \`industry\` VARCHAR(255) NOT NULL,
  \`goal\` VARCHAR(255) DEFAULT NULL,
  \`services\` JSON DEFAULT NULL,
  \`budget\` VARCHAR(100) DEFAULT NULL,
  \`phone\` VARCHAR(50) DEFAULT NULL,
  \`email\` VARCHAR(255) NOT NULL,
  \`note\` TEXT,
  \`status\` ENUM('new','reviewed','contacted','closed') NOT NULL DEFAULT 'new',
  \`submitted_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`read_at\` DATETIME DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_leads_status\` (\`status\`),
  KEY \`idx_leads_market\` (\`market\`),
  KEY \`idx_leads_submitted_at\` (\`submitted_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────── case_studies
CREATE TABLE IF NOT EXISTS \`case_studies\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`client\` VARCHAR(255) NOT NULL,
  \`title\` VARCHAR(255) NOT NULL,
  \`industry\` VARCHAR(255) NOT NULL,
  \`market\` ENUM('Egypt','KSA','Both') DEFAULT NULL,
  \`services\` JSON DEFAULT NULL,
  \`challenge\` TEXT,
  \`outcome\` TEXT,
  \`cover_image\` VARCHAR(500) DEFAULT NULL,
  \`cover_public_id\` VARCHAR(500) DEFAULT NULL,
  \`accent_color\` VARCHAR(20) DEFAULT '#FB6107',
  \`slug\` VARCHAR(255) NOT NULL,
  \`status\` ENUM('draft','published') NOT NULL DEFAULT 'draft',
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_case_studies_slug\` (\`slug\`),
  KEY \`idx_case_studies_status_sort\` (\`status\`,\`sort_order\`),
  KEY \`idx_case_studies_market\` (\`market\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────── testimonials
CREATE TABLE IF NOT EXISTS \`testimonials\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`quote\` TEXT NOT NULL,
  \`author\` VARCHAR(255) NOT NULL,
  \`title\` VARCHAR(255) DEFAULT NULL,
  \`company\` VARCHAR(255) DEFAULT NULL,
  \`industry\` VARCHAR(255) DEFAULT NULL,
  \`rating\` TINYINT DEFAULT 5,
  \`photo\` VARCHAR(500) DEFAULT NULL,
  \`photo_public_id\` VARCHAR(500) DEFAULT NULL,
  \`video_url\` VARCHAR(500) DEFAULT NULL,
  \`video_public_id\` VARCHAR(500) DEFAULT NULL,
  \`thumbnail_url\` VARCHAR(500) DEFAULT NULL,
  \`results_badge\` VARCHAR(100) DEFAULT NULL,
  \`status\` ENUM('draft','published') NOT NULL DEFAULT 'draft',
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_testimonials_status_sort\` (\`status\`,\`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────── logos
CREATE TABLE IF NOT EXISTS \`logos\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(255) NOT NULL,
  \`type\` ENUM('client','partner') NOT NULL,
  \`image\` VARCHAR(500) DEFAULT NULL,
  \`public_id\` VARCHAR(500) DEFAULT NULL,
  \`url\` VARCHAR(500) DEFAULT NULL,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_logos_type_sort\` (\`type\`,\`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────── faq_items
CREATE TABLE IF NOT EXISTS \`faq_items\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`question_en\` TEXT NOT NULL,
  \`answer_en\` TEXT NOT NULL,
  \`question_ar\` TEXT NOT NULL,
  \`answer_ar\` TEXT NOT NULL,
  \`enabled\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_faq_items_enabled_sort\` (\`enabled\`,\`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────── site_config (singleton, id=1)
CREATE TABLE IF NOT EXISTS \`site_config\` (
  \`id\` INT UNSIGNED NOT NULL DEFAULT 1,
  \`linkedin_url\` VARCHAR(500) DEFAULT NULL,
  \`instagram_url\` VARCHAR(500) DEFAULT NULL,
  \`email_contact\` VARCHAR(255) DEFAULT NULL,
  \`meta_title\` VARCHAR(255) DEFAULT NULL,
  \`meta_description\` VARCHAR(500) DEFAULT NULL,
  \`eg_phone\` VARCHAR(50) DEFAULT NULL,
  \`eg_whatsapp\` VARCHAR(50) DEFAULT NULL,
  \`eg_office\` VARCHAR(255) DEFAULT 'Cairo, Egypt',
  \`eg_hours\` VARCHAR(100) DEFAULT 'Sun–Thu, 9am–6pm EET',
  \`eg_cta_subtext\` VARCHAR(255) DEFAULT 'Serving Egypt',
  \`eg_cal_link\` VARCHAR(255) DEFAULT NULL,
  \`ksa_phone\` VARCHAR(50) DEFAULT NULL,
  \`ksa_whatsapp\` VARCHAR(50) DEFAULT NULL,
  \`ksa_office\` VARCHAR(255) DEFAULT 'Riyadh, KSA',
  \`ksa_hours\` VARCHAR(100) DEFAULT 'Sun–Thu, 9am–6pm AST',
  \`ksa_cta_subtext\` VARCHAR(255) DEFAULT 'Serving KSA',
  \`ksa_cal_link\` VARCHAR(255) DEFAULT NULL,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO \`site_config\`
  (\`id\`, \`eg_office\`, \`eg_hours\`, \`eg_cta_subtext\`, \`ksa_office\`, \`ksa_hours\`, \`ksa_cta_subtext\`, \`updated_at\`)
VALUES
  (1, 'Cairo, Egypt', 'Sun–Thu, 9am–6pm EET', 'Serving Egypt', 'Riyadh, KSA', 'Sun–Thu, 9am–6pm AST', 'Serving KSA', NOW());

-- ──────────────────────────────────────── email_config (singleton, id=1)
CREATE TABLE IF NOT EXISTS \`email_config\` (
  \`id\` INT UNSIGNED NOT NULL DEFAULT 1,
  \`smtp_host\` VARCHAR(255) DEFAULT NULL,
  \`smtp_port\` SMALLINT DEFAULT 465,
  \`smtp_secure\` TINYINT(1) DEFAULT 1,
  \`smtp_user\` VARCHAR(255) DEFAULT NULL,
  \`smtp_pass\` VARCHAR(500) DEFAULT NULL,
  \`from_name\` VARCHAR(100) DEFAULT 'Navara',
  \`from_email\` VARCHAR(255) DEFAULT NULL,
  \`notify_email\` VARCHAR(255) DEFAULT NULL,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO \`email_config\`
  (\`id\`, \`smtp_port\`, \`smtp_secure\`, \`from_name\`, \`updated_at\`)
VALUES
  (1, 465, 1, 'Navara', NOW());

-- ──────────────────────────────────────── translations
CREATE TABLE IF NOT EXISTS \`translations\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`lang\` ENUM('en','ar') NOT NULL,
  \`keys_json\` JSON NOT NULL,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_translations_lang\` (\`lang\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO \`translations\` (\`lang\`, \`keys_json\`, \`updated_at\`) VALUES
  ('en', '${enJson}', NOW()),
  ('ar', '${arJson}', NOW());

-- ──────────────────────────────────────── SequelizeMeta (track applied migrations)
CREATE TABLE IF NOT EXISTS \`SequelizeMeta\` (
  \`name\` VARCHAR(255) NOT NULL,
  PRIMARY KEY (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO \`SequelizeMeta\` (\`name\`) VALUES
  ('001-create-leads.js'),
  ('002-create-case-studies.js'),
  ('003-create-testimonials.js'),
  ('004-create-logos.js'),
  ('005-create-faq-items.js'),
  ('006-create-site-config.js'),
  ('007-create-email-config.js'),
  ('008-create-translations.js');

SET FOREIGN_KEY_CHECKS = 1;
`;

process.stdout.write(sql);
