const { query } = require('../../lib/db');
const { sendJson, methodNotAllowed } = require('../../lib/http');

const CATEGORIES = {
  playtime: {
    label: 'Время в игре',
    description: 'Топ игроков по общему времени в игре.',
    format: 'ticks',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.play_time_ticks, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  blocks: {
    label: 'Сломано блоков',
    description: 'Топ игроков по общему количеству добытых блоков.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(SUM(pb.amount), 0)::BIGINT AS value
      FROM player_blocks pb
      LEFT JOIN pd_users u ON u.id = pb.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = pb.auth_user_id
      GROUP BY COALESCE(p.nickname, u.username, 'Игрок')
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  mobs: {
    label: 'Убийства мобов',
    description: 'Топ игроков по количеству убитых мобов.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.mob_kills, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  deaths: {
    label: 'Смерти',
    description: 'Топ игроков по количеству смертей.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.deaths, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  damage_dealt: {
    label: 'Нанесено урона',
    description: 'Топ игроков по нанесённому урону.',
    format: 'damage',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.damage_dealt, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  damage_taken: {
    label: 'Получено урона',
    description: 'Топ игроков по полученному урону.',
    format: 'damage',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.damage_taken, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  jumps: {
    label: 'Прыжки',
    description: 'Топ игроков по количеству прыжков.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(ps.jump_count, 0)::BIGINT AS value
      FROM player_stats ps
      LEFT JOIN pd_users u ON u.id = ps.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  crafts: {
    label: 'Скрафчено предметов',
    description: 'Топ игроков по общему количеству скрафченных предметов.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(SUM(pc.amount), 0)::BIGINT AS value
      FROM player_crafts pc
      LEFT JOIN pd_users u ON u.id = pc.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = pc.auth_user_id
      GROUP BY COALESCE(p.nickname, u.username, 'Игрок')
      ORDER BY value DESC
      LIMIT 50;
    `,
  },

  achievements: {
    label: 'Достижения',
    description: 'Топ игроков по количеству полученных достижений.',
    format: 'number',
    sql: `
      SELECT COALESCE(pa.nickname, p.nickname, u.username, 'Игрок') AS username,
             COUNT(pa.id)::BIGINT AS value
      FROM player_advancements pa
      LEFT JOIN pd_users u ON u.id = pa.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = pa.auth_user_id
      GROUP BY COALESCE(pa.nickname, p.nickname, u.username, 'Игрок')
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
  titles: {
    label: 'Получено титулов',
    description: 'Топ игроков по количеству полученных титулов.',
    format: 'number',
    sql: `
      SELECT COALESCE(t.player_name, p.nickname, u.username, 'Игрок') AS username,
             COUNT(ut.title_id)::BIGINT AS value,
             t.active_title_id AS active_title_id,
             t.standard_title AS role
      FROM pd_player_titles t
      LEFT JOIN pd_unlocked_titles ut ON ut.player_uuid=t.player_uuid
      LEFT JOIN players p ON p.uuid::uuid=t.player_uuid
      LEFT JOIN pd_users u ON u.id=p.auth_user_id
      GROUP BY COALESCE(t.player_name, p.nickname, u.username, 'Игрок'), t.active_title_id, t.standard_title
      ORDER BY value DESC LIMIT 50;
    `,
  },
  enchants: {
    label: 'Потрачено уровней',
    description: 'Топ игроков по уровням, потраченным на зачарования.',
    format: 'number',
    sql: `
      SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
             COALESCE(pe.levels_spent, 0)::BIGINT AS value
      FROM player_enchantments pe
      LEFT JOIN pd_users u ON u.id = pe.auth_user_id
      LEFT JOIN players p ON p.auth_user_id = pe.auth_user_id
      ORDER BY value DESC
      LIMIT 50;
    `,
  },
};

function sanitizeRows(rows) {
  const used = new Set();
  return rows
    .map((row) => ({ username: String(row.username || 'Игрок'), value: Number(row.value || 0), activeTitleId: row.active_title_id || null, role: row.role || null }))
    .filter((row) => row.value > 0)
    .filter((row) => {
      const key = row.username.toLowerCase();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
}

const TOP_CACHE = globalThis.__popkindomTopCache || new Map();
globalThis.__popkindomTopCache = TOP_CACHE;
const TOP_CACHE_MS = 30000;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const categoryKey = String(req.query?.category || 'playtime').toLowerCase();
  const category = CATEGORIES[categoryKey] || CATEGORIES.playtime;

  try {
    const safeCategoryKey = categoryKey in CATEGORIES ? categoryKey : 'playtime';
    const cached = TOP_CACHE.get(safeCategoryKey);
    if (cached && Date.now() - cached.time < TOP_CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return sendJson(res, 200, cached.payload);
    }

    const result = await query(category.sql);
    const payload = {
      category: safeCategoryKey,
      label: category.label,
      description: category.description,
      format: category.format,
      players: sanitizeRows(result.rows),
    };
    TOP_CACHE.set(safeCategoryKey, { time: Date.now(), payload });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      message: 'Ошибка загрузки топа. Возможно, нужная таблица статистики ещё не создана или отличается по структуре.',
      players: [],
    });
  }
};
