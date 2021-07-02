const logger = require('../utils/logger');
const postgres = require('../utils/postgres');

const lockerFactory = require('../lib/postgres_locker');
const queueFactory = require('../lib/postgres_queue');

/**
 * Create Tables & indexes
 *
 * @returns {void} void
 */
async function main() {
  let dbClient = null;

  try {
    logger.info('Creating db & indexes...');
    dbClient = await postgres.getClient();

    const locker = await lockerFactory.createLocker(dbClient);
    await locker.init(dbClient);
    logger.info('[locker] success');

    const queue = await queueFactory.createQueue(dbClient);
    await queue.init(dbClient);
    logger.info('[queue] success');
  } catch (err) {
    logger.error('Creating db & indexes: an error occurred.', { err, stack: err.stack });
    throw err;
  } finally {
    if (dbClient) await postgres.disconnect();
  }
}

/* istanbul ignore if  */
if (!module.parent) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Creating db & indexes: operation failed', { err });
      process.exit(1);
    });
}

module.exports = {
  main
};
