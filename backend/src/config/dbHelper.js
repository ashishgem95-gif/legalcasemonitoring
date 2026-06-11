const { db } = require('../config/database');

const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  const result = stmt.run(params);
  return { id: result.lastInsertRowid, changes: result.changes };
};

const get = (sql, params = []) => db.prepare(sql).get(params);

const all = (sql, params = []) => db.prepare(sql).all(params);

module.exports = { run, get, all };
