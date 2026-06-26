const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../../lib/http');
const { getClientIp, getUserBySession, isPasswordStrong, logSecurity } = require('../../lib/security');
const { isValidPin } = require('../../lib/admin');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  await ensureAuthTables();

  const action = String(req.query?.action || req.query?.section || '').trim().toLowerCase();

  try {
    const user = await getUserBySession(req);
    const ip = getClientIp(req);

    if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });

    if (action !== 'reset-password') {
      return sendJson(res, 404, { message: 'Неизвестное действие безопасности.' });
    }

    const body = await readJson(req);
    const pin = String(body.pin || '');
    const password = String(body.password || body.newPassword || '');
    const passwordRepeat = String(body.passwordRepeat || body.newPasswordRepeat || '');

    if (!user.pin_hash) {
      return sendJson(res, 400, { message: 'Для сброса пароля сначала нужно создать PIN-код.' });
    }

    if (!isValidPin(pin)) {
      return sendJson(res, 400, { message: 'PIN должен состоять из 4 цифр.' });
    }

    const pinOk = await bcrypt.compare(pin, user.pin_hash);
    if (!pinOk) {
      await logSecurity(user, ip, 'PASSWORD_RESET_PIN_FAILED', 'Неверный PIN при сбросе пароля');
      return sendJson(res, 401, { message: 'Неверный PIN-код.' });
    }

    if (password !== passwordRepeat) {
      return sendJson(res, 400, { message: 'Пароли не совпадают.' });
    }

    if (!isPasswordStrong(user.username, password)) {
      return sendJson(res, 400, { message: 'Пароль должен быть минимум 8 символов, не содержать ник и не быть слишком простым.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await query(
      `UPDATE pd_users
       SET password_hash = $1
       WHERE id = $2;`,
      [passwordHash, user.id]
    );

    await query(
      `UPDATE pd_auth_sessions
       SET revoked = TRUE
       WHERE user_id = $1
         AND session_type = 'WEB_48H'
         AND token_hash NOT IN (
           SELECT token_hash
           FROM pd_auth_sessions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1
         );`,
      [user.id]
    ).catch(() => {});

    await logSecurity(user, ip, 'PASSWORD_RESET_SUCCESS', 'Пароль сброшен через страницу безопасности');
    return sendJson(res, 200, { message: 'Пароль успешно сброшен.' });
  } catch (error) {
    console.error('[security]', error);
    return sendJson(res, 500, { message: 'Ошибка действия безопасности.' });
  }
};
