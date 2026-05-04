const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'request error');
  } else {
    logger.warn({ err: { message: err.message }, path: req.path, method: req.method }, 'client error');
  }

  res.status(status).json({
    error: isProd && status >= 500 ? 'Internal server error' : err.message || 'Error',
  });
}

module.exports = { errorHandler };
