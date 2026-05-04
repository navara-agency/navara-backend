const jwt = require('jsonwebtoken');

function signTestToken(payload = { admin: true }, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d', ...opts });
}

function expiredToken(payload = { admin: true }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1s' });
}

function bearer(token) {
  return `Bearer ${token}`;
}

module.exports = { signTestToken, expiredToken, bearer };
