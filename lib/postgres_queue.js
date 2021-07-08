const logger = require('../utils/logger');

module.exports.createQueue = dbClient => ({
  init: async () => {
    logger.info('[queue] init');
    await dbClient.query('drop index if exists prs_channel_pr');
    await dbClient.query('drop table if exists prs');
    await dbClient.query('create table if not exists prs ( id SERIAL PRIMARY KEY,channel VARCHAR (100) not null, pr VARCHAR (100) not null,reporter VARCHAR (100) not null,assigned VARCHAR (100) null default null,queued TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);');
    await dbClient.query('create unique index if not exists prs_channel_pr on prs (channel,pr);');
  },
  push: async (pr, user = null, channel = null) => {
    try {
      logger.info('[queue] push ', { pr, user, channel });
      const text = 'INSERT INTO prs(pr, reporter, channel) VALUES($1, $2, $3) RETURNING *';
      // eslint-disable-next-line max-len
      const values = [pr, user, channel];
      await dbClient.query(text, values);
      return true;
    } catch (err) {
      if (err.message && err.message.match(/^duplicate key.*$/ig)) {
        logger.info('[queue] duplicate PR', { msg: err.message, pr, user, channel });
        return false;
      }
      logger.error('[queue] push error', { msg: err.message, code: err.stack, pr, user, channel });
      return null;
    }
  },
  remove: async pr => {
    const cleanPr = pr;
    logger.info('[queue] remove ', { pr, cleanPr });
    try {
      await dbClient.query('DELETE FROM prs WHERE pr=$1', [cleanPr]);
    } catch (err) {
      logger.error('[queue] remove error', { msg: err.message, code: err.stack, pr, cleanPr });
    }
  },
  pop: async (user = null, channel = null, data = null) => {
    let currentParamIndex = 1;
    const queryParams = [];
    const queryValues = [];

    if (user !== null) {
      // filter.reporter = { $ne: user };
      queryParams.push(`AND reporter != $${currentParamIndex}`);
      queryValues.push(user);
      currentParamIndex += 1;
    }

    if (channel !== null) {
      // filter.scope = channel;
      queryParams.push(`AND channel = $${currentParamIndex}`);
      queryValues.push(channel);
      currentParamIndex += 1;
    }

    if (data !== null) {
      const cleanData = data.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      queryParams.push(`AND pr LIKE $${currentParamIndex}`);
      queryValues.push(`%${cleanData}%`);
      currentParamIndex += 1;
    }

    let row = null;
    try {
      await dbClient.query('BEGIN');
      const query = ['SELECT * FROM prs WHERE assigned is null', ...queryParams, 'ORDER BY id LIMIT 1 FOR UPDATE'].join(' ');
      logger.info('[queue] pop', { queryParams, queryValues, query });

      // SELECT FOR UPDATE
      const { rows: result } = await dbClient.query(
        query,
        queryValues
      );

      if (result.length <= 0) {
        logger.info('[queue] no matching pr for pop');
        return null;
      }

      row = result[0];
      row.assigned = user;
      logger.info('[queue] pop - selected for update', { row });

      const updateResult = await dbClient.query(
        'UPDATE prs SET assigned=$1 WHERE id=$2',
        [user, row.id]
      );
      logger.info('[queue] pop success', { row, rowCount: updateResult.rowCount });
      await dbClient.query('COMMIT');
      return row;
    } catch (err) {
      logger.error('[queue] pop failed', { row, err });
      await dbClient.query('ROLLBACK');
      return null;
    }
  },
  list: async (channel = null) => {
    const queryParams = [];
    let query = 'select * from prs where assigned is null';
    if (channel) {
      query = `${query} AND channel=$1`;
      queryParams.push(channel);
    }
    try {
      logger.info('[queue] list', { query, queryParams });
      const res = await dbClient.query(`${query} ORDER BY id ASC`, queryParams);
      return res.rows;
    } catch (err) {
      logger.error('[queue] list failed', { query, queryParams, err });
      return null;
    }
  },
  getScore: async (user = null) => {
    try {
      const { rowCount: pushed } = await dbClient.query('select id from prs where reporter=$1', [user]);
      const { rowCount: poped } = await dbClient.query('select id from prs where assigned=$1', [user]);

      logger.info('[queue] getScore', { user, pushed, poped });
      const total = pushed + poped;
      if (total > 0) {
        return poped / (total);
      }
      return 0;
    } catch (err) {
      logger.error('[queue] getScore failed', { user, err });
      return 0;
    }
  }
});
