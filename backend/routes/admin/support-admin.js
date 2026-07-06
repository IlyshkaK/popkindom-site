const { query, ensureAuthTables } = require('../../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../../lib/http');
const { getAdminUser, isFullAdminRole } = require('../../lib/admin');

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalize(row) {
  return {
    id: row.id,
    username: row.username,
    contact: row.contact,
    telegramUsername: row.telegram_username,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply,
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireSupportAdmin(req, res) {
  const admin = await getAdminUser(req);
  if (!admin) {
    sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });
    return null;
  }
  if (!isFullAdminRole(admin)) {
    sendJson(res, 403, { message: 'Тех. поддержка доступна только ADMIN и OWNER.' });
    return null;
  }
  return admin;
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();
  const admin = await requireSupportAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const status = clean(req.query?.status || '', 32).toUpperCase();
    const params = [];
    let where = '';
    if (status && status !== 'ALL') {
      params.push(status);
      where = 'WHERE status = $1';
    }

    const result = await query(
      `SELECT *
       FROM pd_support_tickets
       ${where}
       ORDER BY created_at DESC
       LIMIT 100;`,
      params
    );
    return sendJson(res, 200, { tickets: result.rows.map(normalize) });
  }

  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = await readJson(req);
  const id = Number(body.id || 0);
  const status = clean(body.status || 'IN_PROGRESS', 32).toUpperCase();
  const reply = clean(body.reply || body.adminReply, 2000);

  if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { message: 'Некорректное обращение.' });
  if (!['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'].includes(status)) {
    return sendJson(res, 400, { message: 'Некорректный статус обращения.' });
  }

  const result = await query(
    `UPDATE pd_support_tickets
     SET status = $1,
         admin_reply = CASE WHEN $2 = '' THEN admin_reply ELSE $2 END,
         answered_by = CASE WHEN $2 = '' THEN answered_by ELSE $3 END,
         answered_at = CASE WHEN $2 = '' THEN answered_at ELSE NOW() END,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *;`,
    [status, reply, admin.username, id]
  );

  if (!result.rows.length) return sendJson(res, 404, { message: 'Обращение не найдено.' });
  return sendJson(res, 200, { message: 'Обращение обновлено.', ticket: normalize(result.rows[0]) });
};
