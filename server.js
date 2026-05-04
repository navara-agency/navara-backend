require('dotenv').config();

const { createApp } = require('./src/app');
const { authenticate, sequelize } = require('./src/config/db');
const logger = require('./src/config/logger');
require('./src/models'); // register all models

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await authenticate();
    logger.info(
      `Connected to ${sequelize.getDialect()} at ${sequelize.config.host || sequelize.options.storage}/${sequelize.config.database || ''}`
    );

    const app = createApp();

    // Translation health check (Principle V)
    try {
      const { Translation } = require('./src/models');
      const langs = await Translation.findAll({ attributes: ['lang'] });
      const have = new Set(langs.map((l) => l.lang));
      if (!have.has('en') || !have.has('ar')) {
        logger.warn(
          { have: [...have] },
          'Translation rows missing — Principle V requires both en and ar; run npm run seed'
        );
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'translation health check failed (table may be empty)');
    }

    app.listen(PORT, () => {
      logger.info(`Listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  process.exit(1);
});

start();
