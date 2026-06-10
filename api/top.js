const { query, ensureAuthTables } = require('../lib/db');
const { sendJson, methodNotAllowed } = require('../lib/http');

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
    .map((row) => ({ username: String(row.username || 'Игрок'), value: Number(row.value || 0) }))
    .filter((row) => row.value > 0)
    .filter((row) => {
      const key = row.username.toLowerCase();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  await ensureAuthTables();

  const categoryKey = String(req.query?.category || 'playtime').toLowerCase();
  const category = CATEGORIES[categoryKey] || CATEGORIES.playtime;

  try {
    const result = await query(category.sql);
    return sendJson(res, 200, {
      category: categoryKey in CATEGORIES ? categoryKey : 'playtime',
      label: category.label,
      description: category.description,
      format: category.format,
      players: sanitizeRows(result.rows),
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      message: 'Ошибка загрузки топа. Возможно, нужная таблица статистики ещё не создана или отличается по структуре.',
      players: [],
    });
  }
};
