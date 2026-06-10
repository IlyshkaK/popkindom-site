const { query, ensureAuthTables } = require('../_lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../_lib/http');
const { getAdminUser } = require('../_lib/admin');

const ACTIONS = new Set(['BAN', 'TEMP_BAN', 'MUTE', 'TEMP_MUTE', 'UNBAN', 'UNMUTE', 'KICK', 'WHITELIST_REMOVE']);

function parseDurationToDate(raw) {
  const value = String(raw || '').trim().toLowerCase();
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + amount * multipliers[unit]);
}

async function audit(action, target, executor, details) {
  await query(
    `INSERT INTO moderation_audit_log (action, target_player, executor, details, source)
     VALUES ($1, $2, $3, $4, 'WEBSITE');`,
    [action, target, executor, details]
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  await ensureAuthTables();

  try {
    const admin = await getAdminUser(req);
    if (!admin) return sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });

    const body = await readJson(req);
    const username = String(body.username || '').trim();
    const usernameLower = username.toLowerCase();
    const action = String(body.action || '').trim().toUpperCase();
    const reason = String(body.reason || '').trim() || 'Действие выполнено администрацией сайта';

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      return sendJson(res, 400, { message: 'Некорректный ник игрока.' });
    }

    if (!ACTIONS.has(action)) {
      return sendJson(res, 400, { message: 'Неизвестное действие.' });
    }

    if (action === 'BAN' || action === 'TEMP_BAN' || action === 'MUTE' || action === 'TEMP_MUTE' || action === 'KICK') {
      let expiresAt = null;

      if (action === 'TEMP_BAN' || action === 'TEMP_MUTE') {
        expiresAt = parseDurationToDate(body.duration);
        if (!expiresAt) {
          return sendJson(res, 400, { message: 'Укажи срок в формате 10m, 2h или 7d.' });
        }
      }

      if (action === 'BAN' || action === 'TEMP_BAN') {
        await query(
          `UPDATE moderation_punishments
           SET active = FALSE, removed_by = $2, removed_at = NOW(), remove_reason = 'Заменено новым баном с сайта'
           WHERE player_name_lower = $1 AND active = TRUE AND type IN ('BAN', 'TEMP_BAN');`,
          [usernameLower, admin.username]
        );
      }

      if (action === 'MUTE' || action === 'TEMP_MUTE') {
        await query(
          `UPDATE moderation_punishments
           SET active = FALSE, removed_by = $2, removed_at = NOW(), remove_reason = 'Заменено новым мутом с сайта'
           WHERE player_name_lower = $1 AND active = TRUE AND type IN ('MUTE', 'TEMP_MUTE');`,
          [usernameLower, admin.username]
        );
      }

      await query(
        `INSERT INTO moderation_punishments
         (player_name, player_name_lower, type, reason, moderator_name, moderator_uuid, expires_at, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'WEBSITE');`,
        [username, usernameLower, action, reason, admin.username, String(admin.id), expiresAt]
      );

      await audit(action, username, admin.username, `Причина: ${reason}`);

      return sendJson(res, 200, { message: action === 'KICK' ? 'Кик записан в историю.' : 'Действие выполнено.' });
    }

    if (action === 'UNBAN') {
      const result = await query(
        `UPDATE moderation_punishments
         SET active = FALSE, removed_by = $2, removed_at = NOW(), remove_reason = $3
         WHERE player_name_lower = $1 AND active = TRUE AND type IN ('BAN', 'TEMP_BAN');`,
        [usernameLower, admin.username, reason]
      );
      await audit('UNBAN', username, admin.username, `Причина: ${reason}`);
      return sendJson(res, 200, { message: result.rowCount ? 'Бан снят.' : 'Активный бан не найден.' });
    }

    if (action === 'UNMUTE') {
      const result = await query(
        `UPDATE moderation_punishments
         SET active = FALSE, removed_by = $2, removed_at = NOW(), remove_reason = $3
         WHERE player_name_lower = $1 AND active = TRUE AND type IN ('MUTE', 'TEMP_MUTE');`,
        [usernameLower, admin.username, reason]
      );
      await audit('UNMUTE', username, admin.username, `Причина: ${reason}`);
      return sendJson(res, 200, { message: result.rowCount ? 'Мут снят.' : 'Активный мут не найден.' });
    }

    if (action === 'WHITELIST_REMOVE') {
      const result = await query(
        `UPDATE moderation_whitelist
         SET active = FALSE, removed_by = $2, removed_at = NOW()
         WHERE player_name_lower = $1 AND active = TRUE;`,
        [usernameLower, admin.username]
      );
      await audit('WHITELIST_REMOVE', username, admin.username, reason);
      return sendJson(res, 200, { message: result.rowCount ? 'Игрок удалён из whitelist.' : 'Игрока не было в whitelist.' });
    }

    return sendJson(res, 400, { message: 'Действие не обработано.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка выполнения действия.' });
  }
};
