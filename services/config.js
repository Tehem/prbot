require('dotenv-flow').config({
  silent: true
});

module.exports = {
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5499/prbot_development'
  },
  slack: {
    allowIncomplete: process.env.SLACK_INCOMPLETE !== 'false' || true,
    tokens: process.env.SLACK_TOKENS || '',
    users: process.env.SLACK_USERS || '',
    verificationToken: process.env.SLACK_VERIFICATION_TOKEN || '',
    clientSigningSecret: process.env.SLACK_CLIENT_SIGNIN_SECRET || '',

    // auth token for a single-team app
    botToken: process.env.SLACK_BOT_TOKEN || '',

    // credentials used to set up oauth for multi-team apps
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || ''
  },
  githubAuthToken: process.env.GITHUB_AUTH_TOKEN,
  port: process.env.PORT || 8000,
  siteUrl: 'https://test-prbot.herokuapp.com/'
};
