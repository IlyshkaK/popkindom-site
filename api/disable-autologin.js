const { query } = require('./_lib/db');
const { sendJson, methodNotAllowed } = require('./_lib/http');
const { getUserBySession } = require('./_lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  try {
    const user = await getUserBySession(req);

    if (!user) {
      return sendJson(res, 401, {
        message: 'Не авторизован.'
      });
    }

    await query(
      `UPDATE pd_users
       SET auto_login_enabled = false
       WHERE id = $1`,
      [user.id]
    );

    return sendJson(res, 200, {
      message: 'Автовход отключён.'
    });

  } catch (error) {
    console.error(error);

    return sendJson(res, 500, {
      message: 'Ошибка отключения автовхода.'
    });
  }
};