const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../../lib/http');
const {
  getClientIp,
  isValidMinecraftNick,
  isPasswordStrong,
  publicUser,
  createWebSession,
  logSecurity,
} = require('../../lib/security');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  await ensureAuthTables();

  const body = await readJson(req);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const usernameLower = username.toLowerCase();
  const ip = getClientIp(req);

  if (!isValidMinecraftNick(username)) {
    return sendJson(res, 400, { message: 'Ник должен быть 3–16 символов: буквы, цифры и _.' });
  }

  if (!isPasswordStrong(username, password)) {
    return sendJson(res, 400, { message: 'Пароль слишком слабый. Минимум 8 символов, нельзя использовать ник и простые пароли.' });
  }

  try {
    const existing = await query(`SELECT id FROM pd_users WHERE username_lower = $1 LIMIT 1;`, [usernameLower]);

    if (existing.rows.length > 0) {
      return sendJson(res, 409, { message: 'Аккаунт с таким ником уже существует.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await query(
      `INSERT INTO pd_users (username, username_lower, password_hash, registered_from, last_ip, last_web_login)
       VALUES ($1, $2, $3, 'WEB', $4, CURRENT_TIMESTAMP)
       RETURNING *;`,
      [username, usernameLower, passwordHash, ip]
    );

    const user = created.rows[0];

    await query(
      `INSERT INTO moderation_whitelist_requests (user_id, player_name, player_name_lower, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (player_name_lower) WHERE status = 'PENDING'
       DO NOTHING;`,
      [user.id, username, usernameLower]
    );

    await createWebSession(user, ip, res);
    await logSecurity(user, ip, 'REGISTER_WEB', 'Аккаунт зарегистрирован через сайт, создана заявка в whitelist');

    return sendJson(res, 201, { user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка регистрации.' });
  }
};
