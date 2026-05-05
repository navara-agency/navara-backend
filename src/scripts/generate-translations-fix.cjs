#!/usr/bin/env node
/**
 * Generates translations-fix.sql — a tiny SQL file with two UPDATE statements
 * that overwrite the corrupted translations rows with the bundled en.json / ar.json.
 *
 * Use case: when in-process self-heal isn't running (deploy stalled, code not loaded),
 * we can fix the DB directly via phpMyAdmin's Import tab.
 *
 * Run: node src/scripts/generate-translations-fix.cjs > translations-fix.sql
 */
const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'ar.json'), 'utf8'));

function sqlEscape(jsonString) {
  return jsonString.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const enJson = sqlEscape(JSON.stringify(en));
const arJson = sqlEscape(JSON.stringify(ar));

const sql = `-- Navara — translations row repair
-- Generated: ${new Date().toISOString()}
--
-- Overwrites the (currently corrupted) translations.keys_json values with the
-- bundled en.json / ar.json content. Idempotent — safe to re-run.
--
-- Import this file in phpMyAdmin:
--   1. Select the navara DB in the left sidebar
--   2. Click the "Import" tab
--   3. Upload this file
--   4. Click "Import" at the bottom
--
-- After import, hit https://navara.navaraagency.com/api/translations/en —
-- response should be a clean nested object instead of character-indexed garbage.

SET NAMES utf8mb4;

-- Ensure the rows exist (in case the table was emptied)
INSERT INTO \`translations\` (\`lang\`, \`keys_json\`, \`updated_at\`)
VALUES ('en', '{}', NOW())
ON DUPLICATE KEY UPDATE \`updated_at\` = NOW();

INSERT INTO \`translations\` (\`lang\`, \`keys_json\`, \`updated_at\`)
VALUES ('ar', '{}', NOW())
ON DUPLICATE KEY UPDATE \`updated_at\` = NOW();

-- Overwrite with the real bundled JSON
UPDATE \`translations\` SET \`keys_json\` = '${enJson}', \`updated_at\` = NOW() WHERE \`lang\` = 'en';
UPDATE \`translations\` SET \`keys_json\` = '${arJson}', \`updated_at\` = NOW() WHERE \`lang\` = 'ar';
`;

process.stdout.write(sql);
