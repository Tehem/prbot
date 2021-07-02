# Prbot

This project allows to run a Slack Bot that handles queueing, listing and volunteer 
for review on a slack channel. 

## Setup

### Prerequisites

You need the following components :

- [Docker and docker-compose](https://docs.docker.com/get-docker): for your local environment
- [NVM](https://github.com/nvm-sh/nvm#installing-and-updating): to manage your node versions

### Create local environment variables

Create a `.env.local` and an `.env.test.local` file from the `.env` file and fill the values (Slack values coming
from Slack bot initialization) :

| Key | Value |
|-----|------------|
| GITHUB_AUTH_TOKEN | a personal access token to your Github, able to read the PRs |
| SLACK_VERIFICATION_TOKEN | 'CHANGE_ME'
| SLACK_CLIENT_SIGNIN_SECRET | 'CHANGE_ME'
| SLACK_BOT_TOKEN | 'CHANGE_ME'
| SLACK_CLIENT_ID | 'CHANGE_ME'
| SLACK_CLIENT_SECRET | 'CHANGE_ME'
| SLACK_REDIRECT_URI | 'CHANGE_ME'

### Docker environment

Use docker-compose to initiate your local environment:

```
docker-compose up
```

This should create containers for **PostgreSQL**. The data for this container is stored locally
in the `.local/data` directory. If you ever need to reset your environment, just delete the container and then the data
directory. To delete the containers, use the command:

```
docker-compose down
```

## Development

Make sure to use the correct node version:

```
nvm install
```

Install the required dependencies:

```
yarn install
```

Initialize the database:

```
node scripts/init_database.js
NODE_ENV=test node scripts/init_database.js
```

### Running the tests

You can run the tests with:

```
yarn test
```

### How to test locally

You will need a Slack instance somewhere to test with. To set up the bot on
a slack instance, follow the instructions [here](https://botkit.ai/docs/v4/provisioning/slack-events-api.html).

Then just do
 ```
 yarn dev
 ```

You should use ngrok or something similar to publicly expose your running instance:
```
ngrok http 3000
```

Then update all URL settings for the bot with the ngrok url.
Don't forget to update the `SLACK_REDIRECT_URI` value in `.env.local`


And create a test channel and add the bot to the channel.
You can then send requests via public messages in the channel.

## Deployment

The project is already configured for an Heroku deployment. You will need an app
with at least a hobby dyno and a Hobby Dev PostgreSQL addon. Make sure your confiure
the following environment variables on your Heroku app:

| Key | Value |
|-----|------------|
| DATABASE_URL |  _Heroku will set this value automatically when adding PostgreSQL addon_ |
| PGSSLMODE | `no-verify` |
| GITHUB_AUTH_TOKEN | a personal access token to your Github, able to read the PRs |
| SLACK_BOT_TOKEN | _Get this from your Slack app page_
| SLACK_CLIENT_ID | _Get this from your Slack app page_
| SLACK_CLIENT_SECRET | _Get this from your Slack app page_
| SLACK_VERIFICATION_TOKEN | _Get this from your Slack app page_
| SLACK_CLIENT_SIGNIN_SECRET | _Get this from your Slack app page_
| SLACK_INCOMPLETE | `false`
| SLACK_REDIRECT_URI | `https://<your_app_name>.herokuapp.com/app/messages`

## Usage

```
pr
```
Print usage help

```
pr <pr link>
```
Add a pull request to the list

```
pr list
```
List all prs in the queue

```
helping
```
pop a pull request from the list to take care of

```
helping <pr or matching part of it>
```
Pop a particular PR / matching PR from the queue.
For instance, `helping bot` will pop the first PR matching the word bot, and
`helping <pr link>` will pop an exact PR from the queue.
