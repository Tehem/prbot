const expect = require('chai').expect;

const postgres = require('../../utils/postgres');
const lockerFactory = require('../../lib/postgres_locker');

describe('locker', () => {
  describe('when two locks are attempted on a single message', () => {
    let db;

    beforeEach(async () => {
      db = await postgres.getClient();
      await db.query('truncate table msg');
    });

    afterEach(async () => {
      await postgres.disconnect();
    });

    it('exactly one of them should succeed', async () => {
      const locker = lockerFactory.createLocker(db);
      const message = {
        channel: 'test-channel',
          text: 'test',
        type: 'message',
        user: 'john',
        value: 'test',
        incoming_message: {
          timestamp: '2016-09-23T13:07:49.4714686-07:00'
        }
      };
      const result1 = await locker.lock(message);
      const result2 = await locker.lock(message);
      expect(result1).to.equal(!result2);
    });
  });
});
