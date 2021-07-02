const { Botkit } = require('botkit');
const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');
const { PostgresStorage } = require('botbuilder-storage-postgres');

const logger = require('../utils/logger');
const config = require('./config');

const { listenSlackController, answerPrList, answerPrHelp, answerHelping, answerPrSubmission } = require('../lib/bot');

let tokenCache = {};
let userCache = {};

/*
 * Bot Behaviors definition
 * Here you can setup a Regexp matching to a function to handle the message
 */
const BEHAVIORS = [
  { regexString: new RegExp(/^pr <.*>$/), responseGenerator: answerPrSubmission },
  { regexString: new RegExp(/^pr list$/), responseGenerator: answerPrList },
  { regexString: new RegExp(/^pr$/), responseGenerator: answerPrHelp },
  { regexString: new RegExp(/^he[lI]ping/), responseGenerator: answerHelping }
];

if (config.slack.TOKENS) {
  tokenCache = JSON.parse(config.slack.TOKENS);
}

if (config.slack.USERS) {
  userCache = JSON.parse(config.slack.USERS);
}

/**
 * Get Token by team
 * @param {string} teamId team identifier
 * @returns {Promise<string>} the token
 */
async function getTokenForTeam(teamId) {
  if (tokenCache[teamId]) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(tokenCache[teamId]);
      }, 150);
    });
  }
  logger.error('Team not found in tokenCache: ', teamId);
  return null;
}

/**
 * Get bot user id by team
 * @param {string} teamId team identifier
 * @returns {Promise<string>} the bot user
 */
async function getBotUserByTeam(teamId) {
  if (userCache[teamId]) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(userCache[teamId]);
      }, 150);
    });
  }
  logger.error('Team not found in userCache: ', teamId);
  return null;
}

/**
 * Create a slack botkit controller
 *
 * @returns {Botkit} the botkit controller
 */
function createController() {
  const adapter = new SlackAdapter({
    // REMOVE THIS OPTION AFTER YOU HAVE CONFIGURED YOUR APP!
    enable_incomplete: config.slack.allowIncomplete,

    // parameters used to secure webhook endpoint
    verificationToken: config.slack.verificationToken,
    clientSigningSecret: config.slack.clientSigningSecret,

    // auth token for a single-team app
    botToken: config.slack.botToken,

    // credentials used to set up oauth for multi-team apps
    clientId: config.slack.clientId,
    clientSecret: config.slack.clientSecret,
    scopes: ['bot'],
    redirectUri: config.slack.redirectUri,

    // functions required for retrieving team-specific info
    // for use in multi-team apps
    getTokenForTeam,
    getBotUserByTeam
  });

  // Use SlackEventMiddleware to emit events that match their original Slack event types.
  adapter.use(new SlackEventMiddleware());

  // Use SlackMessageType middleware to further classify messages
  // as direct_message, direct_mention, or mention
  adapter.use(new SlackMessageTypeMiddleware());

  // Grab a postgres connection
  const storage = new PostgresStorage({
    uri: config.postgres.connectionString
  });

  return new Botkit({
    webhook_uri: '/api/messages',
    adapter,
    storage
  });
}

/**
 * Create and connect a slackbot
 *
 * @param {Botkit} controller the botkit controller to use
 * @param {Object} queue the queue handler
 * @param {Object} locker the locker
 * @returns {Botkit} The slackbot created
 */
async function connect(controller, queue, locker) {
  logger.info('[slack.js] Connect to slack...');

  // Once the bot has booted up its internal services, you can use them to do stuff.
  controller.ready(() => {
    logger.info('[slack.js] connected to slack');

    // load traditional developer-created local custom feature modules
    // controller.loadModules(`${__dirname}/slackFeatures`);

    logger.info('Starting bot behaviors');
    BEHAVIORS.forEach(behavior => listenSlackController(controller, queue, locker, behavior));
  });

  controller.webserver.get('/', (req, res) => {
    res.send(`This app is running Botkit ${controller.version}.`);
  });

  controller.webserver.get('/install', (req, res) => {
    // getInstallLink points to slack's oauth endpoint and includes clientId and scopes
    res.redirect(controller.adapter.getInstallLink());
  });

  controller.webserver.get('/install/auth', async (req, res) => {
    try {
      const results = await controller.adapter.validateOauthCode(req.query.code);

      logger.info('FULL OAUTH DETAILS', results);

      // Store token by team in bot state.
      tokenCache[results.team_id] = results.bot.bot_access_token;

      // Capture team to bot id
      userCache[results.team_id] = results.bot.bot_user_id;

      res.json('Success! Bot installed.');
    } catch (err) {
      logger.error('OAUTH ERROR:', err);
      res.status(401);
      res.send(err.message);
    }
  });

  return controller;
}

module.exports = {
  createController,
  connect
};
