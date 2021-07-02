const logger = require('./utils/logger');

const postgres = require('./utils/postgres');

const queueFactory = require('./lib/postgres_queue');
const lockerFactory = require('./lib/postgres_locker');

const slack = require('./services/slack');

/**
 * Stop the process on sigterm
 *
 * @returns {Promise<void>} Nothing
 * @private
 */
function _sigterm() {
  logger.info('SIGTERM signal received...');
  return stop('SIGTERM');
}

/* istanbul ignore next */
/**
 * Stop the process on sigint
 *
 * @returns {Promise<void>} Nothing
 * @private
 */
function _sigint() {
  logger.info('SIGINT signal received...');
  return stop('SIGINT');
}

/* istanbul ignore next */
/**
 * Stop the process on uncaughtException
 *
 * @param {Error} err Uncaught error
 * @returns {Promise<void>} Nothing
 * @private
 */
function _uncaughtException(err) {
  logger.info('Received uncaught exception...');
  return stop('uncaughtException', err);
}

/* istanbul ignore next */
/**
 * Stop the process on unhandledRejection
 *
 * @param {Error} err UnhandledRejection error
 * @returns {Promise<void>} Nothing
 * @private
 */
function _unhandledRejection(err) {
  logger.info('Detected unhandled rejection...');
  return stop('unhandledRejection', err);
}

/**
 * Bind process events
 * @returns {void} Nothing
 * @private
 */
function _bindProcess() {
  process.removeListener('SIGTERM', _sigterm);
  process.removeListener('SIGINT', _sigint);
  process.removeListener('uncaughtException', _uncaughtException);
  process.removeListener('unhandledRejection', _unhandledRejection);

  process.once('SIGTERM', _sigterm);
  process.once('SIGINT', _sigint);
  process.once('uncaughtException', _uncaughtException);
  process.once('unhandledRejection', _unhandledRejection);
}

/**
 * Start the application
 *
 * @returns {Promise<void>} void
 */
async function start() {
  _bindProcess();

  const db = await postgres.getClient();
  logger.info('Postgresql connected');

  // create containers instances
  const queue = queueFactory.createQueue(db);
  const locker = lockerFactory.createLocker(db);
  await locker.init();

  logger.info('[slack.js] Connect to slack...');
  const controller = slack.createController();
  await slack.connect(controller, queue, locker);
}

/**
 * Stops the application gracefully
 *
 * @param {string} code type of error
 * @param {Error} err the error
 * @returns {Promise<void>} Nothing
 */
async function stop(code, err = null) {
  if (err) {
    logger.error('Application error', { err, code });
  }

  logger.info('Application stopping', { code });
  Promise.all([
    postgres.disconnect
  ])
    .then(() => {
      logger.info('Application stopped', { code });
      process.exit(err ? 1 : 0);
    })
    .catch(error => {
      logger.info('Application crashed', { error, code });
      process.exit(1);
    });
}

if (!module.parent) {
  start().then(
    () => {
      logger.info('[main] Bot started');
    },
    err => {
      logger.error(`[main] Error ${err.message}`, { err });
      process.exit(1);
    });
}

module.exports = {
  start,
  stop
};
