const { query, ensureAuthTables } = require('../lib/db');
const { sendJson, methodNotAllowed, parseCookies } = require('../lib/http');
const {
  COOKIE_NAME,
  hashToken,
  getClientIp,
  logSecurity,
  clearSessionCookie,
} = require('../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  await ensureAuthTables();

  const token = parseCookies(req)[COOKIE_NAME];
  const ip = getClientIp(req);

  try {
    if (token) {
      const tokenHash = hashToken(token);

      const userResult = await query(
        `SELECT u.*
         FROM pd_auth_sessions s
         JOIN pd_users u ON u.id = s.user_id
         WHERE s.token_hash = $1
         LIMIT 1;`,
        [tokenHash]
      );

      await query(`UPDATE pd_auth_sessions SET revoked = TRUE WHERE token_hash = $1;`, [tokenHash]);

      if (userResult.rows[0]) {
        await logSecurity(userResult.rows[0], ip, 'LOGOUT_WEB', 'Выход из аккаунта на сайте');
      }
    }

    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка выхода.' });
  }
};
