const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed } = require('../_lib/http');
const { getAdminUser } = require('../_lib/admin');

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  await ensureAuthTables();

  try {
    const admin = await getAdminUser(req);
    if (!admin) return sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });

    const search = normalizeSearch(req.query?.search);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE LOWER(u.username) LIKE $1`;
    }

    const sql = `
      SELECT
        u.id,
        u.username,
        u.username_lower,
        u.role,
        u.registered_at,
        u.last_web_login,
        u.last_server_login,
        p.online,
        p.updated_at AS player_updated_at,
        EXISTS (
          SELECT 1 FROM moderation_whitelist wl
          WHERE wl.player_name_lower = u.username_lower AND wl.active = TRUE
        ) AS whitelisted,
        EXISTS (
          SELECT 1 FROM moderation_punishments mp
          WHERE mp.player_name_lower = u.username_lower
            AND mp.active = TRUE
            AND mp.type IN ('BAN', 'TEMP_BAN')
            AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
        ) AS banned,
        EXISTS (
          SELECT 1 FROM moderation_punishments mp
          WHERE mp.player_name_lower = u.username_lower
            AND mp.active = TRUE
            AND mp.type IN ('MUTE', 'TEMP_MUTE')
            AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
        ) AS muted
      FROM pd_users u
      LEFT JOIN players p ON p.auth_user_id = u.id
      ${where}
      ORDER BY COALESCE(p.updated_at, u.last_web_login, u.registered_at) DESC
      LIMIT 80;
    `;

    const result = await query(sql, params);
    return sendJson(res, 200, { players: result.rows });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка загрузки игроков.' });
  }
};
