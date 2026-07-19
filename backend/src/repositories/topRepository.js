const pool = require("../database/pool");

const CATEGORIES = {
  playtime: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.play_time_ticks, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  blocks: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(SUM(pb.amount), 0)::BIGINT AS value
    FROM player_blocks pb
    LEFT JOIN pd_users u ON u.id = pb.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = pb.auth_user_id
    GROUP BY COALESCE(p.nickname, u.username, 'Игрок')
    ORDER BY value DESC
    LIMIT 50
  `,
  mobs: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.mob_kills, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  deaths: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.deaths, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  damage_dealt: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.damage_dealt, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  damage_taken: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.damage_taken, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  jumps: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(ps.jump_count, 0)::BIGINT AS value
    FROM player_stats ps
    LEFT JOIN pd_users u ON u.id = ps.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = ps.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
  crafts: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(SUM(pc.amount), 0)::BIGINT AS value
    FROM player_crafts pc
    LEFT JOIN pd_users u ON u.id = pc.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = pc.auth_user_id
    GROUP BY COALESCE(p.nickname, u.username, 'Игрок')
    ORDER BY value DESC
    LIMIT 50
  `,
  achievements: `
    SELECT COALESCE(pa.nickname, p.nickname, u.username, 'Игрок') AS username,
           COUNT(pa.id)::BIGINT AS value
    FROM player_advancements pa
    LEFT JOIN pd_users u ON u.id = pa.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = pa.auth_user_id
    GROUP BY COALESCE(pa.nickname, p.nickname, u.username, 'Игрок')
    ORDER BY value DESC
    LIMIT 50
  `,
  titles: `
    SELECT COALESCE(t.player_name, p.nickname, u.username, 'Игрок') AS username,
           COUNT(ut.title_id)::BIGINT AS value,
           t.active_title_id,
           t.standard_title AS role
    FROM pd_player_titles t
    LEFT JOIN pd_unlocked_titles ut ON ut.player_uuid = t.player_uuid
    LEFT JOIN players p ON p.uuid::uuid = t.player_uuid
    LEFT JOIN pd_users u ON u.id = p.auth_user_id
    GROUP BY COALESCE(t.player_name, p.nickname, u.username, 'Игрок'), t.active_title_id, t.standard_title
    ORDER BY value DESC
    LIMIT 50
  `,
  enchants: `
    SELECT COALESCE(p.nickname, u.username, 'Игрок') AS username,
           COALESCE(pe.levels_spent, 0)::BIGINT AS value
    FROM player_enchantments pe
    LEFT JOIN pd_users u ON u.id = pe.auth_user_id
    LEFT JOIN players p ON p.auth_user_id = pe.auth_user_id
    ORDER BY value DESC
    LIMIT 50
  `,
};

async function getTopRows(category) {
  const sql = CATEGORIES[category] || CATEGORIES.playtime;
  const result = await pool.query(sql);
  return result.rows;
}

module.exports = {
  getTopRows,
};
