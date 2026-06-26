const { query } = require('../../lib/db');

module.exports = async function healthRoute(req, res) {
  const db = await query('SELECT NOW() AS now');
  res.json({ ok: true, service: 'popkindom-site', db: true, time: db.rows[0].now });
};
