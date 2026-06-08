const { query, ensureAuthTables } = require('./_lib/db');
const { sendJson, methodNotAllowed } = require('./_lib/http');
const { getUserBySession, publicUser } = require('./_lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  await ensureAuthTables();

  try {
    const user = await getUserBySession(req);

    if (!user) {
      return sendJson(res, 401, { message: 'Не авторизован.' });
    }

    const playerResult = await query(
      `SELECT * FROM players WHERE auth_user_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
      [user.id]
    );

    const statsResult = await query(
      `SELECT * FROM player_stats WHERE auth_user_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
      [user.id]
    );

    const logsResult = await query(
      `SELECT action, details, ip_address, created_at
       FROM pd_security_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20;`,
      [user.id]
    );

    return sendJson(res, 200, {
      user: publicUser(user),
      player: playerResult.rows[0] || null,
      stats: statsResult.rows[0] || null,
      securityLogs: logsResult.rows,
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка получения аккаунта.' });
  }
};
