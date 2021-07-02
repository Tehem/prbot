const { Client } = require('pg');

const logger = require('./logger');

const config = require('../services/config');

let client = null;

/**
 * Connect to PostgreSQL and get a client
 *
 * @returns {Promise<Client>} connected database client
 */
async function getClient() {
  client = new Client({ connectionString: config.postgres.connectionString });
  logger.info('[postgres] connect ', { config: config.postgres });
  await client.connect();

  logger.info('[postgres] connected ');
  return client;
}

/**
 * Disconnect from PostgreSQL
 *
 * @returns {Promise<null>} void
 */
async function disconnect() {
  if (client) {
    await client.end();
    logger.info('[postgres] disconnected ');
  } else {
    logger.info('[postgres] already disconnected ');
  }
  client = null;
  return null;
}

module.exports = {
  getClient,
  disconnect
};
