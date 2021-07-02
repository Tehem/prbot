const logger = require('../utils/logger');

module.exports.createLocker = dbClient => ({
  init: async () => {
    logger.info('[locker] init');
    await dbClient.query('drop index if exists msg_user_ts');
    await dbClient.query('drop table if exists msg');
    await dbClient.query('create table if not exists msg ( id SERIAL PRIMARY KEY,msg_channel VARCHAR (100) not null,msg_text text not null,msg_type VARCHAR (100) not null,msg_user VARCHAR (100) not null,msg_ts TIMESTAMP not null )');
    await dbClient.query('create unique index if not exists msg_user_ts on msg (msg_user,msg_ts);');
  },
  lock: async (message) => {
    try {
      logger.info('[locker] locking ', { channel: message.channel, text: message.text, type: message.type, user: message.user, ts: message.incoming_message.timestamp });
      const text = 'INSERT INTO msg(msg_channel, msg_text, msg_type, msg_user, msg_ts) VALUES($1, $2, $3, $4, $5) RETURNING *';
      // eslint-disable-next-line max-len
      const values = [message.channel, message.text, message.type, message.user, message.incoming_message.timestamp];
      await dbClient.query(text, values);
      return true;
    } catch (err) {
      logger.info('[locker] error', { msg: err.message, code: err.stack });
      return false;
    }
  }
});
