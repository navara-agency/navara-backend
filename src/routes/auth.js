const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Hostinger's env-var input mangles bcrypt hashes (inserts literal backslashes before
// every `$`). Workaround: accept the hash base64-encoded via ADMIN_PASSWORD_HASH_B64,
// which contains no shell-special characters. If both are set, _B64 wins.
function loadAdminHash() {
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
      if (decoded.startsWith('$2')) return decoded;
    } catch { /* fall through to plain */ }
  }
  return process.env.ADMIN_PASSWORD_HASH || '';
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedHash = loadAdminHash();
    if (!expectedUser || !expectedHash) {
      return res.status(500).json({ error: 'Auth not configured' });
    }

    if (username !== expectedUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, expectedHash);
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

// TEMP — diagnose env-var mangling on Hostinger. Returns ONLY safe metadata about
// what the server loaded (no plaintext secrets). DELETE this route once login works.
router.get('/_debug', (_req, res) => {
  const u = process.env.ADMIN_USERNAME || '';
  const plain = process.env.ADMIN_PASSWORD_HASH || '';
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64 || '';
  const resolved = loadAdminHash();
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
