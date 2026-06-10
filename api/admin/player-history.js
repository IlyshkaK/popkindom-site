const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed } = require('../_lib/http');
const { getAdminUser } = require('../_lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  await ensureAuthTables();

  try {
    const admin = await getAdminUser(req);
    if (!admin) return sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });

    const username = String(req.query?.username || '').trim();
    const usernameLower = username.toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      return sendJson(res, 400, { message: 'Некорректный ник игрока.' });
    }

    const result = await query(
      `SELECT id, player_name, type, reason, moderator_name, created_at, expires_at, active, removed_by, removed_at, remove_reason, source
       FROM moderation_punishments
       WHERE player_name_lower = $1
       ORDER BY created_at DESC
       LIMIT 30;`,
      [usernameLower]
    );

    return sendJson(res, 200, { history: result.rows });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка загрузки истории наказаний.' });
  }
};
