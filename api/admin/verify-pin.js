const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../_lib/http');
const { getClientIp, getUserBySession, logSecurity } = require('../_lib/security');
const { isAdminRole, isValidPin, createAdminSession } = require('../_lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  await ensureAuthTables();

  const user = await getUserBySession(req);
  const ip = getClientIp(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });
  if (!user.pin_hash) return sendJson(res, 400, { message: 'Сначала создайте PIN.' });

  if (user.pin_locked_until && new Date(user.pin_locked_until).getTime() > Date.now()) {
    return sendJson(res, 423, { message: 'Ввод PIN временно заблокирован. Попробуйте позже.' });
  }

  const body = await readJson(req);
  const pin = String(body.pin || '');
  if (!isValidPin(pin)) return sendJson(res, 400, { message: 'PIN должен состоять из 4 цифр.' });

  try {
    const ok = await bcrypt.compare(pin, user.pin_hash);

    if (!ok) {
      await query(
        `UPDATE pd_users
         SET failed_pin_attempts = failed_pin_attempts + 1,
             pin_locked_until = CASE
               WHEN failed_pin_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + ('15 minutes')::INTERVAL
               ELSE pin_locked_until
             END
         WHERE id = $1;`,
        [user.id]
      );
      await logSecurity(user, ip, 'ADMIN_PIN_FAILED', 'Неверный PIN для входа в админ-панель');
      return sendJson(res, 401, { message: 'Неверный PIN-код.' });
    }

    await query(
      `UPDATE pd_users
       SET failed_pin_attempts = 0,
           pin_locked_until = NULL
       WHERE id = $1;`,
      [user.id]
    );

    await createAdminSession(user, ip, res);
    await logSecurity(user, ip, 'ADMIN_PIN_SUCCESS', 'Вход в админ-панель подтверждён PIN-кодом');

    return sendJson(res, 200, { message: 'Доступ разрешён.', verified: true });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка проверки PIN.' });
  }
};
