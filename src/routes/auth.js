const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Hostinger's env-var input mangles bcrypt hashes (inserts literal backslashes before
// every `$`). Workaround: accept the hash base64-encoded via ADMIN_PASSWORD_HASH_B64,
// which contains no shell-special characters. If both are set, _B64 wins.
function loadAdminHashFromEnv() {
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
      if (decoded.startsWith('$2')) return decoded;
    } catch { /* fall through to plain */ }
  }
  return process.env.ADMIN_PASSWORD_HASH || '';
}

/**
 * Load admin credentials. Prefers the DB row (so they can be edited via the dashboard)
 * and falls back to env vars when the row doesn't exist — keeps existing env-only deploys
 * working until the admin sets a new password through the UI.
 *
 * Returns { username, passwordHash, source: 'db' | 'env' } or null if neither configured.
 */
async function loadAdminCredentials() {
  try {
    const { AdminUser } = require('../models');
    const row = await AdminUser.findByPk(1);
    if (row && row.username && row.passwordHash) {
      return { username: row.username, passwordHash: row.passwordHash, source: 'db' };
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'admin credentials DB read failed; falling back to env');
  }
  const username = process.env.ADMIN_USERNAME || '';
  const passwordHash = loadAdminHashFromEnv();
  if (!username || !passwordHash) return null;
  return { username, passwordHash, source: 'env' };
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

// Stricter limiter for credential mutations — prevents brute-forcing the current password
// to take over the admin account from an authenticated-but-stolen token.
const changeCredsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many credential change attempts. Try again later.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const creds = await loadAdminCredentials();
    if (!creds) {
      return res.status(500).json({ error: 'Auth not configured' });
    }

    if (username !== creds.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, creds.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign({ admin: true, sub: username }, process.env.JWT_SECRET, { expiresIn });
    return res.json({ token, expiresIn });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/me — returns the current admin's username (for displaying in the dashboard).
router.get('/me', requireAuth, async (_req, res, next) => {
  try {
    const creds = await loadAdminCredentials();
    if (!creds) return res.json({ username: null, source: null });
    return res.json({ username: creds.username, source: creds.source });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/change-credentials — requires current password. Accepts new username and/or
// new password. Writes to the DB singleton; future logins read from the DB row.
router.post('/change-credentials', requireAuth, changeCredsLimiter, async (req, res, next) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      return res.status(400).json({ error: 'currentPassword is required' });
    }
    const nextUsername = typeof newUsername === 'string' && newUsername.trim() ? newUsername.trim() : null;
    const nextPassword = typeof newPassword === 'string' && newPassword.length > 0 ? newPassword : null;
    if (!nextUsername && !nextPassword) {
      return res.status(400).json({ error: 'Provide newUsername and/or newPassword' });
    }
    if (nextPassword && nextPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }
    if (nextUsername && (nextUsername.length < 3 || nextUsername.length > 64)) {
      return res.status(400).json({ error: 'newUsername must be 3–64 characters' });
    }

    const creds = await loadAdminCredentials();
    if (!creds) return res.status(500).json({ error: 'Auth not configured' });

    const ok = await bcrypt.compare(currentPassword, creds.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const finalUsername = nextUsername || creds.username;
    const finalHash = nextPassword ? await bcrypt.hash(nextPassword, 12) : creds.passwordHash;

    const { AdminUser } = require('../models');
    let row = await AdminUser.findByPk(1);
    if (row) {
      row.username = finalUsername;
      row.passwordHash = finalHash;
      await row.save();
    } else {
      row = await AdminUser.create({ id: 1, username: finalUsername, passwordHash: finalHash });
    }

    // Existing tokens still work (JWT is stateless) but next login uses the new creds.
    // We return a fresh token with the new sub so the client doesn't keep the old username
    // baked into its session.
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign({ admin: true, sub: finalUsername }, process.env.JWT_SECRET, { expiresIn });
    logger.info({ username: finalUsername, source: 'db' }, 'admin credentials updated');
    return res.json({ ok: true, username: finalUsername, token, expiresIn });
  } catch (err) {
    return next(err);
  }
});

// TEMP — diagnose env-var mangling on Hostinger. Returns ONLY safe metadata about
// what the server loaded (no plaintext secrets). DELETE this route once login works.
router.get('/_debug', (_req, res) => {
  const u = process.env.ADMIN_USERNAME || '';
  const plain = process.env.ADMIN_PASSWORD_HASH || '';
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64 || '';
  const resolved = loadAdminHashFromEnv();
  const j = process.env.JWT_SECRET || '';
  res.json({
    adminUsername: u,
    adminPlainHashLength: plain.length,
    adminB64HashLength: b64.length,
    resolvedHashLength: resolved.length,                 // expect 60
    resolvedHashPrefix: resolved.slice(0, 7),            // expect "$2b$12$" or "$2a$10$"
    resolvedHashStartsWithDollar: resolved.startsWith('$'),
    usingBase64Source: !!(b64 && b64.trim() && resolved.startsWith('$2')),
    jwtSecretLength: j.length,                           // expect 64+
    nodeEnv: process.env.NODE_ENV || null,
  });
});

module.exports = router;
