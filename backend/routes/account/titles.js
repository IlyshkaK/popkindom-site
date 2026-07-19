const { query } = require('../../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../../lib/http');
const { getUserBySession } = require('../../lib/security');
const { TITLES, TITLE_BY_ID } = require('../../lib/titles');
const { normalizeRole } = require('../../lib/roles');

async function titleOwner(userId) {
  const result = await query(`SELECT p.uuid, p.nickname, t.active_title_id, t.standard_title
    FROM players p LEFT JOIN pd_player_titles t ON t.player_uuid = p.uuid::uuid
    WHERE p.auth_user_id=$1 ORDER BY p.online DESC, p.updated_at DESC LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

module.exports = async function handler(req, res) {
  const user = await getUserBySession(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  const owner = await titleOwner(user.id);
  if (!owner?.uuid) return sendJson(res, 409, { message: 'Сначала зайдите на сервер, чтобы связать профиль титулов.' });

  if (req.method === 'GET') {
    const unlocked = await query(`SELECT title_id, unlocked_at FROM pd_unlocked_titles WHERE player_uuid=$1::uuid`, [owner.uuid]);
    const unlockedMap = new Map(unlocked.rows.map((row) => [row.title_id, row.unlocked_at]));
    return sendJson(res, 200, {
      role: normalizeRole(owner.standard_title || user.role),
      activeTitleId: owner.active_title_id,
      unlockedCount: unlocked.rows.length,
      titles: TITLES.map((title) => ({ ...title, unlocked: unlockedMap.has(title.id), unlockedAt: unlockedMap.get(title.id) || null })),
    });
  }

  if (req.method !== 'POST') return methodNotAllowed(res);
  const body = await readJson(req);
  const titleId = body.titleId === null || body.titleId === '' ? null : String(body.titleId || '').trim().toLowerCase();
  if (titleId && !TITLE_BY_ID.has(titleId)) return sendJson(res, 400, { message: 'Неизвестный титул.' });
  if (titleId) {
    const access = await query(`SELECT 1 FROM pd_unlocked_titles WHERE player_uuid=$1::uuid AND title_id=$2`, [owner.uuid, titleId]);
    if (!access.rows.length) return sendJson(res, 403, { message: 'Этот титул ещё не получен.' });
  }
  await query(`UPDATE pd_player_titles SET active_title_id=$1, updated_at=NOW() WHERE player_uuid=$2::uuid`, [titleId, owner.uuid]);
  return sendJson(res, 200, { message: titleId ? `Титул «${TITLE_BY_ID.get(titleId).name}» выбран.` : 'Выбран стандартный титул.', activeTitleId: titleId });
};
