const expect = require('chai').expect;
const sinon = require('sinon');

const statusLoader = require('../../lib/status');
const bot = require('../../lib/bot');

describe('bot.js', () => {
  describe('answerPrSubmission', () => {
    describe('when there is no link after the pr word', () => {
      it('should answer that there is no PR in the message', async () => {
        expect(await bot.answerPrSubmission(null, { text: 'pr toto' }, bot.PRCONFIG))
          .to.eql('No PR found in your message, sorry');
      });
    });

    describe('when there is a pr but the status loader doesn\'t want it', () => {
      before(() => sinon.stub(statusLoader, 'getStatus').returns(Promise.resolve({
        success: false,
        reason: 'my reasons are mine'
      })));

      after(() => statusLoader.getStatus.restore());

      it('should answer the reason returned by the status loader', async () => {
        expect(await bot.answerPrSubmission(null, {
          text: 'pr <https://github.com/transcovo/logger/pull/3>'
        }, bot.PRCONFIG)).to.eql('my reasons are mine');
      });
    });

    describe('when there is a pr and the status loader wants it', () => {
      before(() => sinon.stub(statusLoader, 'getStatus').returns(Promise.resolve({
        success: true,
        metadata: {
          url: 'cannonical_url',
          additions: 1,
          deletions: 2
        }
      })));

      after(() => statusLoader.getStatus.restore());

      it('should push the PR to the queue and report that it did with the stats', async () => {
        const queue = {
          push: (url, user, channel) => {
            expect(url).to.eql('cannonical_url');
            expect(user).to.eql('me');
            expect(channel).to.eql('mychannel');
            return Promise.resolve(true);
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerPrSubmission(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'pr <https://github.com/transcovo/logger/pull/3>'
        }, bot.PRCONFIG)).to.eql('PR in queue +1/-2. Your awesomeness score is 50%.');
      });

      it('should return a duplicate pr info if already there', async () => {
        const queue = {
          push: (url, user, channel) => {
            expect(url).to.eql('cannonical_url');
            expect(user).to.eql('me');
            expect(channel).to.eql('mychannel');
            return Promise.resolve(false);
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerPrSubmission(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'pr <https://github.com/transcovo/logger/pull/3>'
        }, bot.PRCONFIG)).to.eql('PR already in queue.');
      });

      it('should return an error message is some error is catched', async () => {
        const queue = {
          push: (url, user, channel) => {
            expect(url).to.eql('cannonical_url');
            expect(user).to.eql('me');
            expect(channel).to.eql('mychannel');
            return Promise.resolve(null);
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerPrSubmission(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'pr <https://github.com/transcovo/logger/pull/3>'
        }, bot.PRCONFIG)).to.eql('PR could not be added, sorry.');
      });
    });
  });

  describe('answerPrList', () => {
    describe('when all PR are accepted by status loader', () => {
      before(() => {
        sinon.stub(statusLoader, 'getStatus').callsFake((conf, i) => Promise.resolve({
          success: true,
          metadata: {
            url: `cannonical_url_${i.pr}`,
            title: 'test pr',
            ownerTeams: [
              { name: 'test-owners' },
              { name: 'joe-owners' }
            ],
            additions: 1 + parseInt(i.pr, 10),
            deletions: 2 + parseInt(i.pr, 10)
          }
        }));
      }
    );

      after(() => statusLoader.getStatus.restore());

      it('should display all the PRs, without removing anything', async () => {
        const queue = {
          list: () => [{
            id: 1,
            assigned: null,
            pr: '1',
            queued: new Date(),
            reporter: '1',
            channel: 'test'
          }, {
            id: 'test2',
            assigned: null,
            pr: '2',
            queued: new Date(),
            reporter: '2',
            channel: 'test'
          }],
          remove: () => {}
        };

        const answer = await bot.answerPrList(queue, {
          user: 'me',
          channel: 'test',
          text: 'pr list'
        }, bot.PRCONFIG);

        expect(answer).to.eql('2 PR(s) in queue\n -> cannonical_url_1 test pr +2/-3 (a few seconds ago) (CO: test-owners, joe-owners)\n -> cannonical_url_2 test pr +3/-4 (a few seconds ago) (CO: test-owners, joe-owners)');
      });
    });

    describe('when some PR are rejected by status loader', () => {
      before(() => sinon.stub(statusLoader, 'getStatus').callsFake((conf, i) => Promise.resolve([{
        success: true,
        metadata: {
          url: `cannonical_url_${i.pr}`,
          title: 'test pr',
          ownerTeams: [
            { name: 'test-owners' }
          ],
          additions: 1 + parseInt(i.pr, 10),
          deletions: 2 + parseInt(i.pr, 10)
        }
      }, {
        success: false,
        reason: 'back off'
      }][parseInt(i.pr, 10) - 1])));

      after(() => statusLoader.getStatus.restore());

      it('should display the accepted PRs, and remove the others from the queue', async () => {
        const removed = [];

        const queue = {
          list: () => Promise.resolve([{
            id: 1,
            assigned: null,
            pr: '1',
            queued: new Date(),
            reporter: '1',
            channel: 'test'
          }, {
            id: 'test2',
            assigned: null,
            pr: '2',
            queued: new Date(),
            reporter: '2',
            channel: 'test'
          }]),
          remove: pr => {
            removed.push(pr);
            return Promise.resolve();
          }
        };

        expect(await bot.answerPrList(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'pr list'
        }, bot.PRCONFIG)).to.eql('1 PR(s) in queue\n -> cannonical_url_1 test pr +2/-3 (a few seconds ago) (CO: test-owners)');

        expect(removed).to.eql(['2']);
      });
    });

    describe('when PR titles are too long in status loader', () => {
      before(() => {
          sinon.stub(statusLoader, 'getStatus').callsFake((conf, i) => Promise.resolve({
            success: true,
            metadata: {
              url: `cannonical_url_${i.pr}`,
              title: '[Project 2] Add a new controller that finalize the project and it is awesome',
              ownerTeams: [
                { name: 'test-owners' },
                { name: 'joe-owners' }
              ],
              additions: 1 + parseInt(i.pr, 10),
              deletions: 2 + parseInt(i.pr, 10)
            }
          }));
        }
      );

      after(() => statusLoader.getStatus.restore());
      it('should truncate PR titles', async() => {
        const queue = {
          list: () => [{
            id: 1,
            assigned: null,
            pr: '1',
            queued: new Date(),
            reporter: '1',
            channel: 'test'
          }],
          remove: () => {}
        };

        const answer = await bot.answerPrList(queue, {
          user: 'me',
          channel: 'test',
          text: 'pr list'
        }, bot.PRCONFIG);

        expect(answer).to.eql('1 PR(s) in queue\n -> cannonical_url_1 [Project 2] Add a new controller that finalize the [...] +2/-3 (a few seconds ago) (CO: test-owners, joe-owners)');
      });
    })
  });

  describe('answerPrHelp', () => {
    it('should return a non empty string without crashing', async () => {
      expect(await bot.answerPrHelp(null, null, bot.PRCONFIG)).to.equal(bot.PRCONFIG.help);
    });
  });

  describe('answerHelping', () => {
    describe('when there are PRs in the queue', () => {
      it('should return whatever the queue has in first place', async () => {
        let popCallParams;
        const queue = {
          pop: (user, channel, data) => {
            popCallParams = { user, channel, data };
            return Promise.resolve({ pr: 'a pr' });
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerHelping(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'helping'
        })).to.eql('a pr Your awesomeness score is 50%.');
        expect(popCallParams).to.eql({
          user: 'me',
          channel: 'mychannel',
          data: null
        });
      });
      it('should return if the message is in capital case', async () => {
        let popCallParams = {};
        const queue = {
          pop: (user, channel, data) => {
            popCallParams = { user, channel, data };
            return Promise.resolve({ pr: 'a pr' });
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerHelping(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'HELPING a'
        })).to.eql('a pr Your awesomeness score is 50%.');
        expect(popCallParams).to.eql({
          user: 'me',
          channel: 'mychannel',
          data: 'a'
        });
      });
    });
    describe('when a specific PR is requested by full URL and extra spaces', () => {
      it('should return this PR', async () => {
        let popCallParams;
        const queue = {
          pop: (user, channel, data) => {
            popCallParams = { user, channel, data };
            return Promise.resolve({ pr: 'the pr' });
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerHelping(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'helping  <the pr> '
        })).to.eql('the pr Your awesomeness score is 50%.');
        expect(popCallParams).to.eql({
          user: 'me',
          channel: 'mychannel',
          data: 'the pr'
        });
      });
    });
    describe('when there are no PRs in the queue', () => {
      it('should return a polite error message', async () => {
        let popCallParams;
        const queue = {
          pop: (user, channel, data) => {
            popCallParams = { user, channel, data };
            return Promise.resolve(null);
          },
          getScore: () => Promise.resolve(0.5)
        };
        expect(await bot.answerHelping(queue, {
          user: 'me',
          channel: 'mychannel',
          text: 'helping'
        })).to.eql('Sorry, no more PRs for you in stock! Your awesomeness score is 50%.');
        expect(popCallParams).to.eql({
          user: 'me',
          channel: 'mychannel',
          data: null
        });
      });
    });
  });

  describe('listenSlackController', () => {
    const message = {};

    const queue = {};

    it('should reply the response when there is one', async () => {
      const behavior = {
        regex: '^whatever$',
        async responseGenerator() {
          return 'Everything is ok';
        }
      };

      const response = await new Promise(resolve => {
        const slackBot = {
          reply: (replyMessage, responseText) => {
            resolve({ replyMessage, responseText });
          }
        };

        const slackController = {
          hears: (regexString, context, callback) => {
            callback(slackBot, message);
          }
        };

        const locker = {
          lock: () => Promise.resolve(true)
        };

        bot.listenSlackController(slackController, queue, locker, behavior);
      });

      expect(response.replyMessage).to.equal(message);
      expect(response.responseText).to.equal('Everything is ok');
    });
    it('should reply the response when there is one', async () => {
      const behavior = {
        regex: '^whatever$',
        async responseGenerator() {
          return 'Everything is ok';
        }
      };

      const response = await new Promise(resolve => {
        const slackBot = {
          reply: (replyMessage, responseText) => {
            resolve({ replyMessage, responseText });
          }
        };

        const slackController = {
          hears: (regexString, context, callback) => {
            callback(slackBot, message);
          }
        };

        const locker = {
          lock: () => Promise.resolve(true)
        };

        bot.listenSlackController(slackController, queue, locker, behavior);
      });

      expect(response.replyMessage).to.equal(message);
      expect(response.responseText).to.equal('Everything is ok');
    });
  });
});
