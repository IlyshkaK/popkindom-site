const pool = require("../database/pool");

async function findAccountById(userId) {
  const result = await pool.query(
    `
    SELECT
      id,
      username AS nickname,
      role,
      registered_at,
      last_server_login,
      last_web_login,
      auto_login_enabled,
      admin_panel_enabled,
      pin_hash,
      locked_until,
      pin_locked_until
    FROM pd_users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findPlayerByUserId(userId) {
  const result = await pool.query(
    `
    SELECT
      uuid,
      nickname,
      first_join,
      last_join,
      play_time_ticks,
      deaths,
      mob_kills,
      online,
      xp_level,
      total_experience,
      exp_progress
    FROM players
    WHERE auth_user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findStatsByUserId(userId) {
  const result = await pool.query(
    `
    SELECT
      play_time_ticks,
      deaths,
      mob_kills,
      walk_distance,
      fly_distance,
      jump_count,
      damage_dealt,
      damage_taken,
      sleep_count,
      open_chest,
      updated_at
    FROM player_stats
    WHERE auth_user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findBlocksByUserId(userId) {
  const result = await pool.query(
    `
    SELECT block_type, amount, updated_at
    FROM player_blocks
    WHERE auth_user_id = $1
    ORDER BY amount DESC
    LIMIT 20
    `,
    [userId]
  );

  return result.rows;
}

async function findCraftsByUserId(userId) {
  const result = await pool.query(
    `
    SELECT item_type, amount, updated_at
    FROM player_crafts
    WHERE auth_user_id = $1
    ORDER BY amount DESC
    LIMIT 20
    `,
    [userId]
  );

  return result.rows;
}

async function findEnchantmentsByUserId(userId) {
  const result = await pool.query(
    `
    SELECT levels_spent, enchant_count, updated_at
    FROM player_enchantments
    WHERE auth_user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findAdvancementsByUserId(userId) {
  const result = await pool.query(
    `
    SELECT advancement_key, advancement_title, created_at
    FROM player_advancements
    WHERE auth_user_id = $1
    ORDER BY created_at DESC
    LIMIT 10
    `,
    [userId]
  );

  return result.rows;
}

async function countAdvancementsByUserId(userId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM player_advancements
    WHERE auth_user_id = $1
    `,
    [userId]
  );

  return result.rows[0]?.count || 0;
}

async function findDeathHistoryByUserId(userId) {
  const result = await pool.query(
    `
    SELECT death_reason, world_name, x, y, z, created_at
    FROM player_death_history
    WHERE auth_user_id = $1
    ORDER BY created_at DESC
    LIMIT 10
    `,
    [userId]
  );

  return result.rows;
}

async function findOnlinePlayers() {
  const result = await pool.query(
    `
    SELECT nickname, online, updated_at
    FROM players
    WHERE online = TRUE
    ORDER BY updated_at DESC
    LIMIT 20
    `
  );

  return result.rows;
}

module.exports = {
  findAccountById,
  findPlayerByUserId,
  findStatsByUserId,
  findBlocksByUserId,
  findCraftsByUserId,
  findEnchantmentsByUserId,
  findAdvancementsByUserId,
  countAdvancementsByUserId,
  findDeathHistoryByUserId,
  findOnlinePlayers,
};
