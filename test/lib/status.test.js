const sinon = require('sinon');
const github = require('octonode');
const expect = require('chai').expect;
const prParser = require('../../lib/pr_parser');
const status = require('../../lib/status');

const MOCK_PR = {
  owner: 'me',
  repo: 'my-awesome-repo',
  id: 42,
  requested_teams: [
    {
      name: 'b2c-user-intelligence-owners'
    }
  ]
};

describe('status.js', () => {
  describe('getPrStatus', () => {
    describe('when PR url cannot be parsed', () => {
      before(() => sinon.stub(prParser, 'parse').returns(null));

      after(() => prParser.parse.restore());

      it('should report a failure', async () => {
        const result = await status.getPrStatus('whatever');
        expect(result).to.be.an('object');
        expect(result).to.have.property('success', false);
        expect(result).to.have.property('reason').with.length.greaterThan(0);
      });
    });

    describe('when PR url can be parsed...', () => {
      before(() => sinon.stub(prParser, 'parse').returns(MOCK_PR));

      after(() => prParser.parse.restore());

      describe('... and github call returns an error', () => {
        before(() => sinon.stub(github, 'client').returns({
          get: (url, cb) => cb(new Error())
        }));

        after(() => github.client.restore());

        it('should report a failure', async () => {
          const result = await status.getPrStatus('whatever');
          expect(result).to.be.an('object');
          expect(result).to.have.property('success', false);
          expect(result).to.have.property('reason').with.length.greaterThan(0);
        });
      });

      describe('... and github call succeeds but not with the expected 200 OK', () => {
        before(() => sinon.stub(github, 'client').returns({
          get: (url, cb) => cb(null, 404)
        }));

        after(() => github.client.restore());

        it('should report a failure', async () => {
          const result = await status.getPrStatus('whatever');
          expect(result).to.be.an('object');
          expect(result).to.have.property('success', false);
          expect(result).to.have.property('reason').with.length.greaterThan(0);
        });
      });

      describe('... and the PR is not open', () => {
        before(() => sinon.stub(github, 'client').returns({
          get: (url, cb) => cb(null, 200, {
            state: 'merged'
          })
        }));

        after(() => github.client.restore());

        it('should report a failure', async () => {
          const result = await status.getPrStatus('whatever');
          expect(result).to.be.an('object');
          expect(result).to.have.property('success', false);
          expect(result).to.have.property('reason').with.length.greaterThan(0);
        });
      });

      describe('... and the PR is open and has required data', () => {
        before(() => sinon.stub(github, 'client').returns({
          get: (url, cb) => cb(null, 200, {
            state: 'open',
            html_url: 'html_url',
            title: 'test',
            requested_teams: [{ name: 'b2c-user-intelligence-owners' }],
            additions: 1,
            deletions: 2
          })
        }));

        after(() => github.client.restore());

        it('should report a succces with the correct metadata', async () => {
          const result = await status.getPrStatus('whatever');
          expect(result).to.be.an('object');
          expect(result).to.have.property('success', true);
          expect(result).to.not.have.property('reason');
          expect(result).to.have.property('metadata');
          expect(result.metadata).to.deep.equal({
            url: 'html_url',
            title: 'test',
            ownerTeams: [{ name: 'b2c-user-intelligence-owners' }],
            additions: 1,
            deletions: 2,
            changes: 3
          });
        });
      });
    });
  });
});
