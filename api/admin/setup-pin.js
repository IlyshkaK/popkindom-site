const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../_lib/http');
const { getClientIp, getUserBySession, logSecurity } = require('../_lib/security');
const { isAdminRole, isValidPin, createAdminSession } = require('../_lib/admin');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  await ensureAuthTables();

  const user = await getUserBySession(req);
  const ip = getClientIp(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });
  if (user.pin_hash) return sendJson(res, 409, { message: 'PIN уже создан.' });

  const body = await readJson(req);
  const pin = String(body.pin || '');
  const pinRepeat = String(body.pinRepeat || '');

  if (!isValidPin(pin)) return sendJson(res, 400, { message: 'PIN должен состоять из 4 цифр.' });
  if (pin !== pinRepeat) return sendJson(res, 400, { message: 'PIN-коды не совпадают.' });

  try {
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await query(
      `UPDATE pd_users
       SET pin_hash = $1,
           failed_pin_attempts = 0,
           pin_locked_until = NULL
       WHERE id = $2;`,
      [pinHash, user.id]
    );

    await createAdminSession(user, ip, res);
    await logSecurity(user, ip, 'ADMIN_PIN_CREATED', 'Создан PIN для входа в админ-панель');

    return sendJson(res, 200, { message: 'PIN создан.', verified: true });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка создания PIN.' });
  }
};
