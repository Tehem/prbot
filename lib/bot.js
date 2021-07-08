const logger = require('../utils/logger');

const statusLoader = require('./status');
const moment = require('moment');

const PRCONFIG = {
  type: 'pr',
  name: 'PR',
  submissionRegexp: /^pr <(.*)>$/,
  help: `Basic use:
  *pr https://example.com/my-pr* -> Add this pr to the queue
  *helping* -> Pop a pr from the queue
  *helping https://example.com/my-pr* -> Pop a specific from the queue
Other:
  *pr* -> display this help
  *pr list* -> displays the queue`
};

/**
 * answerPrSubmission replies to a message that attempts to submit a PR
 *
 * @param {queue} queue The queue manager dependency (see queue.js)
 * @param {message} message a message instance coming from the slack client
 * @param {config} config The config of the pr type
 * @returns {Promise.<string>} the response of the bot
 */
async function answerPrSubmission(queue, message, config) {
  logger.info('[bot.js] pr submit ');

  // links come from slack between < and >
  const match = (config.submissionRegexp).exec(message.text);
  const pr = match && match[1];

  if (!pr) {
    return `No ${config.name} found in your message, sorry`;
  }

  const status = await statusLoader.getStatus(config.type, { pr });
  if (!status.success) {
    return status.reason;
  }

  const pushResult = await queue.push(
    status.metadata.url,
    message.user,
    message.channel,
    config.type
  );

  if (pushResult === false) {
    return `${config.name} already in queue.`;
  } else if (pushResult === null) {
    return `${config.name} could not be added, sorry.`;
  }

  return `${config.name} in queue +${status.metadata.additions}/-${status.metadata.deletions}.`;
}

/**
 * answerPrList replies to a message that attempts to list the pull request
 *
 * @param {queue} queue The queue manager dependency (see queue.js)
 * @param {message} message a message instance coming from the slack client
 * @param {config} config The config of the pr type
 * @returns {Promise.<string>} the response of the bot
 */
async function answerPrList(queue, message, config) {
  const list = await queue.list(message.channel);

  const formattedList = [];

  const statuses = await Promise.all(list.map(x => statusLoader.getStatus(config.type, x)));
  logger.info('[bot.js] listing ', { list, statuses });

  const prsToRemove = [];
  for (let index = 0; index < list.length; index += 1) {
    const pr = list[index];
    const status = statuses[index];
    if (status.success) {
      formattedList.push(_formatItem(status, pr.queued));
    } else {
      prsToRemove.push(pr.pr);
    }
  }

  await Promise.all(prsToRemove.map(queue.remove));

  return [`${formattedList.length} ${config.name}(s) in queue`].concat(formattedList).join('\n -> ');
}

/**
 * answerPrHelp replies to a message that requests the help text
 *
 * This function is not actually async, but we need to comply to the protocol used
 * by the other responses.
 *
 * @param {queue} queue The queue manager dependency (see queue.js)
 * @param {message} message a message instance coming from the slack client
 * @param {config} config The config of the pr type
 * @returns {Promise.<string>} the response of the bot
 */
async function answerPrHelp(queue, message, config) {
  return config.help;
}

/**
 * answerHelping replies to a message that requests a PR to rewiew
 *
 * @param {queue} queue The queue manager dependency (see queue.js)
 * @param {message} message a message instance coming from the slack client
 * @returns {Promise.<string>} the response of the bot
 */
async function answerHelping(queue, message) {
  const match = /^helping\s*(.*)$/i.exec(message.text);
  let request = match && match[1];
  request = request.trim();
  if (request.startsWith('<') && request.endsWith('>')) {
    request = request.substring(1, request.length - 1);
  }

  logger.info('[bot.js] Helping ', { request });
  const pr = await queue.pop(
    message.user,
    message.channel,
    request || null
  );

  return `${(pr && pr.pr) || 'Sorry, no more PRs for you in stock!'}`;
}

/**
 * listenSlackController starts listening to the slack controller and answer
 * using a list of behavior.
 *
 * @param {slack} slackController The slack client dependency, created with
 * slack.connect() (see slack.js)
 * @param {queue} queue The queue manager dependency (see queue.js)
 * @param {locker} locker The locker manager dependency (see locker.js)
 * @param {object} behavior The behavior to use (see item in BEHAVIORS
 * variable above for an example)
 * @returns {void}
 */
function listenSlackController(slackController, queue, locker, behavior) {
  /**
   * Replies to a single message: lock it to avoid other instances answering simultaneously,
   * and the use the behavior to reply.
   * @param {message} message a message instance coming from the slack client
   * @returns {Promise.<string>|null} the response of the bot
   */
  async function getReply(message) {
    logger.info('[bot.js] getReply entering...');
    const lockSuccess = await locker.lock(message);
    if (!lockSuccess) {
      return null;
    }

    return behavior.responseGenerator(queue, message, PRCONFIG);
  }

  slackController.hears(
    behavior.regexString,
    ['message', 'direct_message', 'direct_mention', 'mention', 'ambient'],
    async (bot, message) => {
      logger.info('[bot.js] Incoming message', { message: message.text });

      try {
        const response = await getReply(message);
        if (response === null) {
          logger.info('[bot.js] error acquiring lock');
          return;
        }

        await bot.reply(message, response);
      } catch (err) {
        logger.info('[bot.js] error in getReply', { err });
      }
    }
  );
}

/**
 * Format the PR queue date as a 'XXX days ago'
 * @see https://momentjs.com/docs/#/displaying/fromnow/
 * @param {Date} date the date to format
 * @returns {string} formatted date
 * @private
 */
function _formatFrom(date) {
  if (!date) {
    return '-';
  }
  return moment(date).fromNow();
}

/**
 * Format the PR title for display
 *
 * @param {string} title title from PR status
 * @returns {string} formatted title
 * @private
 */
function _formatTitle(title) {
  if (!title) {
    return '';
  }
  return title.replace(/(.{50})..+/, '$1 [...]');
}

/**
 * Format the code owner(s) for the PR as a list
 * @param {Array} ownerTeams list of owner teams objects (from 'requested_teams')
 * @returns {String} list of owner teams or none if none specified
 * @private
 */
function _formatOwners(ownerTeams) {
  if (!ownerTeams || !ownerTeams.length) {
    return 'none';
  }
  if (ownerTeams.length === 1) {
    return ownerTeams[0].name;
  }
  return ownerTeams.reduce((acc, current) => `${acc.name || acc}, ${current.name}`);
}

/**
 * Format a PR item for output in list
 *
 * @param {Object} item the PR item
 * @param {Date} queued date the PR was queued
 * @returns {string} formatted list item
 * @private
 */
function _formatItem(item, queued) {
  return `${item.metadata.url} ${_formatTitle(item.metadata.title)} +${item.metadata.additions}/-${item.metadata.deletions} (${_formatFrom(queued)}) (CO: ${_formatOwners(item.metadata.ownerTeams)})`;
}

module.exports = {
  answerPrSubmission,
  answerPrList,
  answerPrHelp,
  answerHelping,
  listenSlackController,
  PRCONFIG
};
