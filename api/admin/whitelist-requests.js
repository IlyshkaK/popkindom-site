const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../_lib/http');
const { getAdminUser } = require('../_lib/admin');

async function audit(action, target, executor, details) {
  await query(
    `INSERT INTO moderation_audit_log (action, target_player, executor, details, source)
     VALUES ($1, $2, $3, $4, 'WEBSITE');`,
    [action, target, executor, details]
  );
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();

  try {
    const admin = await getAdminUser(req);
    if (!admin) return sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });

    if (req.method === 'GET') {
      const result = await query(
        `SELECT r.id, r.player_name, r.player_name_lower, r.status, r.created_at, u.role, u.last_web_login
         FROM moderation_whitelist_requests r
         LEFT JOIN pd_users u ON u.id = r.user_id
         WHERE r.status = 'PENDING'
         ORDER BY r.created_at ASC
         LIMIT 80;`
      );

      return sendJson(res, 200, { requests: result.rows });
    }

    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = await readJson(req);
    const id = Number(body.id);
    const decision = String(body.decision || '').trim().toUpperCase();
    const reason = String(body.reason || '').trim() || 'Решение администрации сайта';

    if (!Number.isInteger(id) || id <= 0) {
      return sendJson(res, 400, { message: 'Некорректная заявка.' });
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return sendJson(res, 400, { message: 'Некорректное решение.' });
    }

    const requestResult = await query(
      `SELECT * FROM moderation_whitelist_requests WHERE id = $1 AND status = 'PENDING' LIMIT 1;`,
      [id]
    );

    const request = requestResult.rows[0];
    if (!request) return sendJson(res, 404, { message: 'Активная заявка не найдена.' });

    if (decision === 'APPROVE') {
      await query(
        `INSERT INTO moderation_whitelist (player_name, player_name_lower, added_by, reason, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (player_name_lower)
         DO UPDATE SET
           player_name = EXCLUDED.player_name,
           added_by = EXCLUDED.added_by,
           reason = EXCLUDED.reason,
           active = TRUE,
           removed_by = NULL,
           removed_at = NULL;`,
        [request.player_name, request.player_name_lower, admin.username, reason]
      );
    }

    await query(
      `UPDATE moderation_whitelist_requests
       SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_reason = $4
       WHERE id = $1;`,
      [id, decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', admin.username, reason]
    );

    await audit(decision === 'APPROVE' ? 'WHITELIST_APPROVE' : 'WHITELIST_REJECT', request.player_name, admin.username, reason);

    return sendJson(res, 200, { message: decision === 'APPROVE' ? 'Игрок добавлен в whitelist.' : 'Заявка отклонена.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка обработки whitelist-заявки.' });
  }
};
