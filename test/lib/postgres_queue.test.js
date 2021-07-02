const expect = require('chai').expect;

const postgres = require('../../utils/postgres');
const queueFactory = require('../../lib/postgres_queue');

describe('queue', () => {
  describe('when db connection is successful', () => {
    let db;

    beforeEach(async () => {
      db = await postgres.getClient();
      await db.query('truncate table prs');
    });

    afterEach(async () => {
      await postgres.disconnect();
    });

    it('should implement basic queue behavior', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'test');
      const item = await queue.list();
      expect(item).to.deep.equal([{
        id: item[0].id,
        assigned: null,
        pr: 'AAA',
        queued: item[0].queued,
        reporter: 'joe',
        channel: 'test'
      }]);

      await queue.push('BBB', 'jane', 'test');
      const items = await queue.list();
      expect(items).to.deep.equal([{
        id: items[0].id,
        assigned: null,
        pr: 'AAA',
        queued: items[0].queued,
        reporter: 'joe',
        channel: 'test'
      },
      {
        id: items[1].id,
        assigned: null,
        pr: 'BBB',
        queued: items[1].queued,
        reporter: 'jane',
        channel: 'test'
      }]);

      expect(await queue.pop('unknown')).to.deep.equal(
        {
          id: items[0].id,
          assigned: 'unknown',
          pr: 'AAA',
          queued: items[0].queued,
          reporter: 'joe',
          channel: 'test'
        }
      );

      const item2 = await queue.list();
      expect(item2).to.deep.equal([{
        id: item2[0].id,
        assigned: null,
        pr: 'BBB',
        queued: item2[0].queued,
        reporter: 'jane',
        channel: 'test'
      }]);

      expect(await queue.pop('unknown')).to.deep.equal(
        {
          id: item2[0].id,
          assigned: 'unknown',
          pr: 'BBB',
          queued: item2[0].queued,
          reporter: 'jane',
          channel: 'test'
        }
      );

      expect(await queue.list()).to.deep.equal([]);
    });

    it('should pop the specified PR', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'test');
      await queue.push('BBB', 'jane', 'test');

      expect((await queue.pop('unknown', null, 'BBB')).pr).to.equal('BBB');
    });

    it('should pop the specified PR with a part of the URL', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'test');
      await queue.push('BBB/pull/123', 'joe', 'test');

      expect((await queue.pop('unknown', null, 'B/pull/123')).pr).to.equal('BBB/pull/123');
    });

    it('should remove items', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'test');

      const item = await queue.list();
      expect(item).to.deep.equal([{
        id: item[0].id,
        assigned: null,
        pr: 'AAA',
        queued: item[0].queued,
        reporter: 'joe',
        channel: 'test'
      }]);

      await queue.remove('AAA');

      expect(await queue.list()).to.deep.equal([]);
    });

    it('should not offer items to the reporter', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'test');

      expect(await queue.pop('joe')).to.equal(null);

      const item = await queue.list();
      expect(item).to.deep.equal([{
        id: item[0].id,
        assigned: null,
        pr: 'AAA',
        queued: item[0].queued,
        reporter: 'joe',
        channel: 'test'
      }]);
    });

    it('should return null when there are no more items to pop', async () => {
      const queue = queueFactory.createQueue(db);
      expect(await queue.pop('joe')).to.equal(null);
    });

    it('should filter by channel', async () => {
      const queue = queueFactory.createQueue(db);

      await queue.push('AAA', 'joe', 'channelA');

      const item = await queue.list('channelA');
      expect(item).to.deep.equal([{
        id: item[0].id,
        assigned: null,
        pr: 'AAA',
        queued: item[0].queued,
        reporter: 'joe',
        channel: 'channelA'
      }]);
      expect(await queue.list('channelB')).to.deep.equal([]);

      expect(await queue.pop('unknown', 'channelB')).to.equal(null);
      expect((await queue.pop('unknown', 'channelA')).pr).to.equal('AAA');
    });

    it('should compute the score', async () => {
      const queue = queueFactory.createQueue(db);

      expect(await queue.getScore('userForScore1')).to.equal(0);

      await queue.push('AAA', 'userForScore1', 'test');
      await queue.push('BBB', 'userForScore2', 'test');

      expect(await queue.getScore('userForScore1')).to.equal(0);

      await queue.pop('userForScore1');

      expect(await queue.getScore('userForScore1')).to.equal(0.5);
      expect(await queue.getScore('userForScore2')).to.equal(0);
    });
  });

  describe('when db connection fails', () => {
    let db;

    before(async () => {
      db = { query: async (query, clauses) => { if('ROLLBACK' !== query) {throw new Error(); }} };
    });

    it('should reject list calls without crashing', async() => {
      let error = null;
      const queue = queueFactory.createQueue(db);
      try {
        await queue.list();
      } catch(e) {
        error = e;
      }

      expect(error).to.equal(null);
    });

    it('should reject push calls without crashing', async() => {
      let error = null;
      const queue = queueFactory.createQueue(db);
      try {
        await queue.push();
      } catch(e) {
        error = e;
      }

      expect(error).to.equal(null);
    });

    it('should reject pop calls without crashing', async() => {
      let error = null;
      const queue = queueFactory.createQueue(db);
      try {
        await queue.pop();
      } catch(e) {
        error = e;
      }

      expect(error).to.equal(null);
    });

    it('should reject remove calls without crashing', async() => {
      let error = null;
      const queue = queueFactory.createQueue(db);
      try {
        await queue.remove();
      } catch(e) {
        error = e;
      }

      expect(error).to.equal(null);
    });
  });
});
