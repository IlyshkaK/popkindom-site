const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed } = require('../_lib/http');
const { getAdminUser } = require('../_lib/admin');

async function safeCount(sql) {
  try {
    const result = await query(sql);
    return Number(result.rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  await ensureAuthTables();

  try {
    const admin = await getAdminUser(req);
    if (!admin) return sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });

    const [usersCount, onlineCount, adminCount, whitelistRequestsCount] = await Promise.all([
      safeCount(`SELECT COUNT(*) FROM pd_users;`),
      safeCount(`SELECT COUNT(*) FROM players WHERE online = TRUE;`),
      safeCount(`SELECT COUNT(*) FROM pd_users WHERE role IN ('ADMIN', 'OWNER');`),
      safeCount(`SELECT COUNT(*) FROM moderation_whitelist_requests WHERE status = 'PENDING';`),
    ]);

    let latestPlayers = [];
    try {
      const result = await query(
        `SELECT u.username, u.role, u.registered_at, u.last_web_login, p.online, p.updated_at AS player_updated_at
         FROM pd_users u
         LEFT JOIN players p ON p.auth_user_id = u.id
         ORDER BY COALESCE(u.last_web_login, u.registered_at) DESC
         LIMIT 10;`
      );
      latestPlayers = result.rows;
    } catch {
      const result = await query(
        `SELECT username, role, registered_at, last_web_login, FALSE AS online, NULL AS player_updated_at
         FROM pd_users
         ORDER BY COALESCE(last_web_login, registered_at) DESC
         LIMIT 10;`
      );
      latestPlayers = result.rows;
    }

    return sendJson(res, 200, {
      admin: { username: admin.username, role: admin.role },
      cards: {
        usersCount,
        onlineCount,
        adminCount,
        whitelistRequestsCount,
      },
      latestPlayers,
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка загрузки админ-панели.' });
  }
};
