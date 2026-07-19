const pool = require("../database/pool");
const { normalizeRole } = require("../utils/roles");

async function findUserById(userId) {
  const result = await pool.query(
    `
    SELECT id, username, username_lower, role, pin_hash, failed_pin_attempts,
           pin_locked_until, auto_login_enabled, admin_panel_enabled
    FROM pd_users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function countUsers() {
  const r = await pool.query(`SELECT COUNT(*)::int AS count FROM pd_users`);
  return r.rows[0]?.count || 0;
}

async function countOnline() {
  const r = await pool.query(`SELECT COUNT(*)::int AS count FROM players WHERE online = TRUE`);
  return r.rows[0]?.count || 0;
}

async function countAdmins() {
  const r = await pool.query(`SELECT COUNT(*)::int AS count FROM pd_users WHERE LOWER(role) IN ('admin','spec.admin','owner')`);
  return r.rows[0]?.count || 0;
}

async function countPendingWhitelist() {
  const r = await pool.query(`SELECT COUNT(*)::int AS count FROM moderation_whitelist_requests WHERE status = 'PENDING'`);
  return r.rows[0]?.count || 0;
}

async function findPlayers(search = "") {
  const params = [];
  let where = "";

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where = `WHERE LOWER(u.username) LIKE $1`;
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.username_lower,
      u.role,
      u.registered_at,
      u.last_web_login,
      u.last_server_login,
      COALESCE(p.online, FALSE) AS online,
      p.updated_at AS player_updated_at,
      EXISTS (
        SELECT 1 FROM moderation_whitelist wl
        WHERE wl.player_name_lower = u.username_lower AND wl.active = TRUE
      ) AS whitelisted,
      EXISTS (
        SELECT 1 FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('BAN', 'TEMP_BAN')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
      ) AS banned,
      EXISTS (
        SELECT 1 FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('MUTE', 'TEMP_MUTE')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
      ) AS muted
    FROM pd_users u
    LEFT JOIN players p ON p.auth_user_id = u.id
    ${where}
    ORDER BY COALESCE(p.updated_at, u.last_web_login, u.registered_at) DESC
    LIMIT 100
    `,
    params
  );

  return result.rows;
}

async function tableExists(tableName) {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists
    `,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function getTableColumns(tableName) {
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

function selectColumn(alias, columns, column, fallback = "NULL") {
  return columns.has(column) ? `${alias}.${column}` : fallback;
}

async function findPlayerDetails(usernameLower) {
  const playersColumns = await getTableColumns("players");

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.username_lower,
      u.role,
      u.registered_at,
      u.last_web_login,
      u.last_server_login,
      COALESCE(${selectColumn("p", playersColumns, "online", "FALSE")}, FALSE) AS online,
      ${selectColumn("p", playersColumns, "uuid")} AS uuid,
      ${selectColumn("p", playersColumns, "updated_at")} AS player_updated_at,
      EXISTS (
        SELECT 1 FROM moderation_whitelist wl
        WHERE wl.player_name_lower = u.username_lower AND wl.active = TRUE
      ) AS whitelisted,
      EXISTS (
        SELECT 1 FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('BAN', 'TEMP_BAN')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
      ) AS banned,
      EXISTS (
        SELECT 1 FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('MUTE', 'TEMP_MUTE')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
      ) AS muted,
      (
        SELECT mp.expires_at FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('BAN', 'TEMP_BAN')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
        ORDER BY mp.created_at DESC
        LIMIT 1
      ) AS ban_expires_at,
      (
        SELECT mp.expires_at FROM moderation_punishments mp
        WHERE mp.player_name_lower = u.username_lower
          AND mp.active = TRUE
          AND mp.type IN ('MUTE', 'TEMP_MUTE')
          AND (mp.expires_at IS NULL OR mp.expires_at > NOW())
        ORDER BY mp.created_at DESC
        LIMIT 1
      ) AS mute_expires_at
    FROM pd_users u
    LEFT JOIN players p ON p.auth_user_id = u.id
    WHERE u.username_lower = $1
    LIMIT 1
    `,
    [usernameLower]
  );

  return result.rows[0] || null;
}

async function findPlayerStats(authUserId, uuid) {
  if (!(await tableExists("player_stats"))) return {};
  const columns = await getTableColumns("player_stats");
  const conditions = [];
  const params = [];

  if (columns.has("auth_user_id") && authUserId !== undefined && authUserId !== null) {
    params.push(authUserId);
    conditions.push(`auth_user_id = $${params.length}`);
  }
  if (columns.has("uuid") && uuid) {
    params.push(String(uuid));
    conditions.push(`uuid = $${params.length}`);
  }
  if (!conditions.length) return {};

  const orderColumn = columns.has("updated_at") ? "updated_at" : columns.has("last_updated") ? "last_updated" : null;
  const result = await pool.query(
    `SELECT * FROM player_stats WHERE ${conditions.join(" OR ")} ${orderColumn ? `ORDER BY ${orderColumn} DESC` : ""} LIMIT 1`,
    params
  );
  return result.rows[0] || {};
}

async function findPlayerBlocksTotal(authUserId, uuid) {
  if (!(await tableExists("player_blocks"))) return 0;
  const columns = await getTableColumns("player_blocks");
  const amountColumn = columns.has("amount") ? "amount" : columns.has("count") ? "count" : columns.has("total") ? "total" : null;
  if (!amountColumn) return 0;

  const conditions = [];
  const params = [];
  if (columns.has("auth_user_id") && authUserId !== undefined && authUserId !== null) {
    params.push(authUserId);
    conditions.push(`auth_user_id = $${params.length}`);
  }
  if (columns.has("uuid") && uuid) {
    params.push(String(uuid));
    conditions.push(`uuid = $${params.length}`);
  }
  if (!conditions.length) return 0;

  const result = await pool.query(
    `SELECT COALESCE(SUM(${amountColumn}), 0)::bigint AS total FROM player_blocks WHERE ${conditions.join(" OR ")}`,
    params
  );
  return Number(result.rows[0]?.total || 0);
}

async function findRecentDeaths(authUserId, uuid, limit = 3) {
  if (!(await tableExists("player_death_history"))) return [];
  const columns = await getTableColumns("player_death_history");
  const conditions = [];
  const params = [];

  if (columns.has("auth_user_id") && authUserId !== undefined && authUserId !== null) {
    params.push(authUserId);
    conditions.push(`auth_user_id = $${params.length}`);
  }
  if (columns.has("uuid") && uuid) {
    params.push(String(uuid));
    conditions.push(`uuid = $${params.length}`);
  }
  if (!conditions.length) return [];

  const createdColumn = columns.has("created_at") ? "created_at" : columns.has("death_time") ? "death_time" : columns.has("died_at") ? "died_at" : null;
  const reasonColumn = columns.has("death_reason") ? "death_reason" : columns.has("reason") ? "reason" : columns.has("cause") ? "cause" : null;
  const worldColumn = columns.has("world_name") ? "world_name" : columns.has("world") ? "world" : null;

  const result = await pool.query(
    `
    SELECT
      ${columns.has("id") ? "id" : "NULL"} AS id,
      ${reasonColumn || "NULL"} AS death_reason,
      ${worldColumn || "NULL"} AS world_name,
      ${columns.has("x") ? "x" : "NULL"} AS x,
      ${columns.has("y") ? "y" : "NULL"} AS y,
      ${columns.has("z") ? "z" : "NULL"} AS z,
      ${createdColumn || "NULL"} AS created_at
    FROM player_death_history
    WHERE ${conditions.join(" OR ")}
    ${createdColumn ? `ORDER BY ${createdColumn} DESC` : ""}
    LIMIT $${params.length + 1}
    `,
    [...params, Math.max(1, Math.min(Number(limit) || 3, 10))]
  );

  return result.rows;
}

async function findActivePunishments(usernameLower) {
  const result = await pool.query(
    `
    SELECT id, player_name, type, reason, moderator_name, created_at,
           expires_at, active, source
    FROM moderation_punishments
    WHERE player_name_lower = $1
      AND active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [usernameLower]
  );

  return result.rows;
}

async function findTargetUser(usernameLower) {
  const result = await pool.query(
    `
    SELECT id, username, username_lower, role
    FROM pd_users
    WHERE username_lower = $1
    LIMIT 1
    `,
    [usernameLower]
  );

  return result.rows[0] || null;
}

async function findPlayerHistory(usernameLower) {
  const result = await pool.query(
    `
    SELECT id, player_name, type, reason, moderator_name, created_at,
           expires_at, active, removed_by, removed_at, remove_reason, source
    FROM moderation_punishments
    WHERE player_name_lower = $1
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [usernameLower]
  );

  return result.rows;
}

async function findWhitelistRequests() {
  const result = await pool.query(
    `
    SELECT r.id, r.player_name, r.player_name_lower, r.status, r.created_at,
           u.role, u.last_web_login
    FROM moderation_whitelist_requests r
    LEFT JOIN pd_users u ON u.id = r.user_id
    WHERE r.status = 'PENDING'
    ORDER BY r.created_at ASC
    LIMIT 100
    `
  );

  return result.rows;
}

async function findWhitelistRequestById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM moderation_whitelist_requests
    WHERE id = $1 AND status = 'PENDING'
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function approveWhitelistRequest(request, adminName, reason) {
  await pool.query(
    `
    INSERT INTO moderation_whitelist
      (player_name, player_name_lower, added_by, reason, active)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (player_name_lower)
    DO UPDATE SET
      player_name = EXCLUDED.player_name,
      added_by = EXCLUDED.added_by,
      reason = EXCLUDED.reason,
      active = TRUE,
      removed_by = NULL,
      removed_at = NULL
    `,
    [request.player_name, request.player_name_lower, adminName, reason]
  );
}

async function reviewWhitelistRequest(id, status, adminName, reason) {
  await pool.query(
    `
    UPDATE moderation_whitelist_requests
    SET status = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        review_reason = $4
    WHERE id = $1
    `,
    [id, status, adminName, reason]
  );
}

async function insertPunishment(username, usernameLower, type, reason, moderatorName, moderatorId, expiresAt) {
  await pool.query(
    `
    INSERT INTO moderation_punishments
      (player_name, player_name_lower, type, reason, moderator_name, moderator_uuid, expires_at, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'WEBSITE')
    `,
    [username, usernameLower, type, reason, moderatorName, String(moderatorId), expiresAt]
  );
}

async function deactivatePunishments(usernameLower, types, adminName, reason) {
  await pool.query(
    `
    UPDATE moderation_punishments
    SET active = FALSE,
        removed_by = $2,
        removed_at = CURRENT_TIMESTAMP,
        remove_reason = $3
    WHERE player_name_lower = $1
      AND active = TRUE
      AND type = ANY($4::text[])
    `,
    [usernameLower, adminName, reason, types]
  );
}

async function removeWhitelist(usernameLower) {
  await pool.query(
    `DELETE FROM moderation_whitelist WHERE player_name_lower = $1`,
    [usernameLower]
  );
}

async function updateRole(usernameLower, role) {
  await pool.query(
    `UPDATE pd_users SET role = $1 WHERE username_lower = $2`,
    [role, usernameLower]
  );
}

async function updatePassword(usernameLower, passwordHash) {
  await pool.query(
    `UPDATE pd_users SET password_hash = $1 WHERE username_lower = $2`,
    [passwordHash, usernameLower]
  );
}

async function resetPin(usernameLower) {
  await pool.query(
    `
    UPDATE pd_users
    SET pin_hash = NULL,
        failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE username_lower = $1
    `,
    [usernameLower]
  );
}

async function revokeUserSessions(usernameLower, sessionType = null) {
  if (sessionType) {
    await pool.query(
      `
      UPDATE pd_auth_sessions
      SET revoked = TRUE
      WHERE user_id = (SELECT id FROM pd_users WHERE username_lower = $1)
        AND session_type = $2
      `,
      [usernameLower, sessionType]
    );
    return;
  }

  await pool.query(
    `
    UPDATE pd_auth_sessions
    SET revoked = TRUE
    WHERE user_id = (SELECT id FROM pd_users WHERE username_lower = $1)
    `,
    [usernameLower]
  );
}

async function insertPrivateMessage(username, usernameLower, adminName, message) {
  await pool.query(
    `
    INSERT INTO moderation_private_messages
      (player_name, player_name_lower, sender_name, message)
    VALUES ($1, $2, $3, $4)
    `,
    [username, usernameLower, adminName, message]
  );
}

async function insertModerationCommand(commandType, username, usernameLower, executor, reason, payload = {}) {
  await pool.query(
    `
    INSERT INTO moderation_commands
      (command_type, player_name, player_name_lower, executor, reason, payload, source)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'WEBSITE')
    `,
    [commandType, username, usernameLower, executor, reason, JSON.stringify(payload || {})]
  );
}

async function insertSiteAction(action, username, usernameLower, reason, executorName, executorRole, targetRole, expiresAt = null) {
  await pool.query(
    `
    INSERT INTO moderation_site_actions
      (action, player_name, player_name_lower, reason, executor_name, executor_role, target_role, expires_at, processed)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
    `,
    [action, username, usernameLower, reason, executorName, normalizeRole(executorRole), normalizeRole(targetRole), expiresAt]
  );
}

async function audit(action, target, executor, details) {
  await pool.query(
    `
    INSERT INTO moderation_audit_log
      (action, target_player, executor, details, source)
    VALUES ($1, $2, $3, $4, 'WEBSITE')
    `,
    [action, target, executor, details]
  );
}

module.exports = {
  findUserById,
  countUsers,
  countOnline,
  countAdmins,
  countPendingWhitelist,
  findPlayers,
  findPlayerDetails,
  findPlayerStats,
  findPlayerBlocksTotal,
  findRecentDeaths,
  findActivePunishments,
  findTargetUser,
  findPlayerHistory,
  findWhitelistRequests,
  findWhitelistRequestById,
  approveWhitelistRequest,
  reviewWhitelistRequest,
  insertPunishment,
  deactivatePunishments,
  removeWhitelist,
  updateRole,
  updatePassword,
  resetPin,
  revokeUserSessions,
  insertPrivateMessage,
  insertModerationCommand,
  insertSiteAction,
  audit,
};
