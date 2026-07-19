const { query } = require('../../lib/db');
const { sendJson, methodNotAllowed } = require('../../lib/http');
const { getUserBySession, publicUser } = require('../../lib/security');
const { normalizeRole } = require('../../lib/roles');

function getQueryParam(req, name) {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, name)) return req.query[name];
  try {
    const url = new URL(req.url || '', 'http://localhost');
    return url.searchParams.get(name);
  } catch {
    return null;
  }
}

const ACCOUNT_CACHE = globalThis.__popkindomAccountCache || new Map();
globalThis.__popkindomAccountCache = ACCOUNT_CACHE;
const ACCOUNT_CACHE_MS = 2500;

function accountCacheKey(userId) {
  return String(userId || 'unknown');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    // Быстрый путь: если нет cookie сессии, не трогаем PostgreSQL и не прогреваем схемы.
    const user = await getUserBySession(req);

    if (!user) {
      return sendJson(res, 401, { message: 'Не авторизован.' });
    }

    const summaryOnly = getQueryParam(req, 'summary') === '1';

    // Для шапки, страницы безопасности и проверки доступа не нужны тяжёлые таблицы статистики.
    if (summaryOnly) {
      res.setHeader('Cache-Control', 'private, max-age=5, stale-while-revalidate=20');
      return sendJson(res, 200, {
        user: {
          ...publicUser(user),
          autoLoginEnabled: user.auto_login_enabled !== false,
          hasPin: Boolean(user.pin_hash),
        },
        summary: true,
      });
    }


    const cacheKey = accountCacheKey(user.id);
    const cachedAccount = ACCOUNT_CACHE.get(cacheKey);
    if (cachedAccount && Date.now() - cachedAccount.time < ACCOUNT_CACHE_MS) {
      res.setHeader('Cache-Control', 'private, max-age=2, stale-while-revalidate=8');
      return sendJson(res, 200, cachedAccount.payload);
    }

    const [
      playerResult,
      statsResult,
      blocksResult,
      craftsResult,
      enchantmentsResult,
      deathsResult,
      achievementsResult,
      achievementsCountResult,
      onlineResult,
      logsResult,
    ] = await Promise.all([
      query(
        `SELECT *
         FROM players
         WHERE auth_user_id = $1
         ORDER BY online DESC, updated_at DESC
         LIMIT 1;`,
        [user.id]
      ),
      query(
        `SELECT *
         FROM player_stats
         WHERE auth_user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1;`,
        [user.id]
      ),
      query(
        `SELECT block_type, amount, updated_at
         FROM player_blocks
         WHERE auth_user_id = $1
         ORDER BY amount DESC
         LIMIT 3;`,
        [user.id]
      ),
      query(
        `SELECT item_type, amount, updated_at
         FROM player_crafts
         WHERE auth_user_id = $1
         ORDER BY amount DESC
         LIMIT 3;`,
        [user.id]
      ),
      query(
        `SELECT levels_spent, enchant_count, updated_at
         FROM player_enchantments
         WHERE auth_user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1;`,
        [user.id]
      ),
      query(
        `SELECT death_reason, world_name, x, y, z, created_at
         FROM player_death_history
         WHERE auth_user_id = $1
         ORDER BY created_at DESC
         LIMIT 3;`,
        [user.id]
      ),
      query(
        `SELECT advancement_key, advancement_title, created_at
         FROM player_advancements
         WHERE auth_user_id = $1
         ORDER BY created_at DESC
         LIMIT 5;`,
        [user.id]
      ),
      query(
        `SELECT COUNT(*)::BIGINT AS total
         FROM player_advancements
         WHERE auth_user_id = $1;`,
        [user.id]
      ),
      query(
        `SELECT nickname, online, updated_at
         FROM players
         ORDER BY online DESC, updated_at DESC
         LIMIT 8;`
      ),
      query(
        `SELECT action, details, ip_address, created_at
         FROM pd_security_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20;`,
        [user.id]
      ),
    ]);

    const player = playerResult.rows[0] || null;
    let effectiveRole = normalizeRole(user.role);
    if (player?.uuid) {
      try {
        const titleRole = await query(`SELECT standard_title FROM pd_player_titles WHERE player_uuid=$1::uuid LIMIT 1`, [player.uuid]);
        if (titleRole.rows[0]?.standard_title) {
          effectiveRole = normalizeRole(titleRole.rows[0].standard_title);
          if (effectiveRole !== normalizeRole(user.role)) await query(`UPDATE pd_users SET role=$1 WHERE id=$2`, [effectiveRole, user.id]);
        }
      } catch (roleError) {
        console.warn('title role sync skipped:', roleError.message);
      }
    }

    const payload = {
      user: {
        ...publicUser({ ...user, role: effectiveRole }),
        autoLoginEnabled: user.auto_login_enabled !== false,
        hasPin: Boolean(user.pin_hash),
      },
      player,
      stats: statsResult.rows[0] || null,
      blocks: blocksResult.rows,
      crafts: craftsResult.rows,
      enchantments: enchantmentsResult.rows[0] || null,
      deathsHistory: deathsResult.rows,
      recentDeaths: deathsResult.rows,
      achievements: achievementsResult.rows,
      recentAchievements: achievementsResult.rows,
      achievementsCount: Number(achievementsCountResult.rows[0]?.total || 0),
      achievements_count: Number(achievementsCountResult.rows[0]?.total || 0),
      onlinePlayers: onlineResult.rows,
      securityLogs: logsResult.rows,
      meta: {
        isOnline: Boolean(player && player.online === true),
        updatedAt: player?.updated_at || null,
      },
    };

    ACCOUNT_CACHE.set(accountCacheKey(user.id), { time: Date.now(), payload });
    res.setHeader('Cache-Control', 'private, max-age=2, stale-while-revalidate=8');
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка получения аккаунта.' });
  }
};
