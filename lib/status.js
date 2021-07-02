const config = require('../services/config');
const github = require('octonode');
const prParser = require('./pr_parser');

/**
 * Get the current status of a pull request
 * @param {Object} prObject information about PR
 * @returns {Promise} pr status
 */
function getPrStatus(prObject) {
  const { pr: prUrl } = prObject;
  const client = github.client(config.githubAuthToken);
  const prData = prParser.parse(prUrl);

  if (prData === null) {
    return Promise.resolve({
      success: false,
      reason: 'Sorry, this doesn\'t look like the URL of a PR :=)'
    });
  }

  return new Promise(resolve => {
    client.get(`/repos/${prData.owner}/${prData.repo}/pulls/${prData.id}`, (err, code, data) => {
      const result = {};
      if (err) {
        result.success = false;
        result.reason = `Sorry, an error occurred while contacting Github ${err}`;
      } else if (code !== 200) {
        result.success = false;
        result.reason = `Sorry, an error occurred while contacting Github ${code}`;
      } else if (data.state !== 'open') {
        result.success = false;
        result.reason = 'Sorry, this PR is not open :=)';
      } else {
        result.success = true;
        result.metadata = {
          url: data.html_url,
          title: data.title,
          ownerTeams: data.requested_teams || [],
          additions: data.additions,
          deletions: data.deletions,
          changes: data.additions + data.deletions
        };
      }
      return resolve(result);
    });
  });
}

/**
 * Get the current status of a jira ticket or pr request
 * @param {string} type Whether it is a Jira ticket or a PR
 * @param {Object} object information about Jira ticket or PR
 * @returns {Promise} jira status
 */
function getStatus(type, object) {
  switch (type) {
    case 'pr':
      return getPrStatus(object);
    default:
      return getPrStatus(object);
  }
}

module.exports = {
  getStatus,
  getPrStatus
};
