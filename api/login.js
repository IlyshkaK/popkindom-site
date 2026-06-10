const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../lib/http');
const {
  getClientIp,
  publicUser,
  createWebSession,
  logSecurity,
} = require('../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  await ensureAuthTables();

  const body = await readJson(req);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const usernameLower = username.toLowerCase();
  const ip = getClientIp(req);

  try {
    const result = await query(`SELECT * FROM pd_users WHERE username_lower = $1 LIMIT 1;`, [usernameLower]);
    const user = result.rows[0];

    if (!user) {
      return sendJson(res, 401, { message: 'Неверный ник или пароль.' });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return sendJson(res, 423, { message: 'Аккаунт временно заблокирован. Попробуйте позже.' });
    }

    const verified = await bcrypt.compare(password, user.password_hash);

    if (!verified) {
      await query(
        `UPDATE pd_users
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE
               WHEN failed_login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + ('15 minutes')::INTERVAL
               ELSE locked_until
             END
         WHERE id = $1;`,
        [user.id]
      );

      await logSecurity(user, ip, 'LOGIN_FAILED_WEB', 'Неверный пароль на сайте');
      return sendJson(res, 401, { message: 'Неверный ник или пароль.' });
    }

    await query(
      `UPDATE pd_users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_ip = $1,
           last_web_login = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [ip, user.id]
    );

    await createWebSession(user, ip, res);
    await logSecurity(user, ip, 'LOGIN_SUCCESS_WEB', 'Успешный вход на сайт');

    return sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка входа.' });
  }
};
