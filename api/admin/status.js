const { ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed } = require('../_lib/http');
const { getUserBySession, publicUser } = require('../_lib/security');
const { isAdminRole, getAdminUser } = require('../_lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  await ensureAuthTables();

  try {
    const user = await getUserBySession(req);
    if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
    if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });

    const verifiedUser = await getAdminUser(req);

    return sendJson(res, 200, {
      user: publicUser(user),
      hasPin: Boolean(user.pin_hash),
      verified: Boolean(verifiedUser),
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка проверки админ-доступа.' });
  }
};
