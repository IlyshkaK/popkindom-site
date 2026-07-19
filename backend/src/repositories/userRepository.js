const pool = require("../database/pool");

async function findByNickname(nickname) {
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
      admin_panel_enabled
      pin_hash
    FROM pd_users
    WHERE username_lower = LOWER($1)
       OR LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [nickname]
  );

  return result.rows[0] || null;
}

async function findAuthByNickname(nickname) {
  const result = await pool.query(
    `
    SELECT
      id,
      username AS nickname,
      username_lower,
      password_hash,
      role,
      locked_until,
      failed_login_attempts,
      auto_login_enabled,
      admin_panel_enabled,
      pin_hash
    FROM pd_users
    WHERE username_lower = LOWER($1)
       OR LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [nickname]
  );

  return result.rows[0] || null;
}

async function updateLastWebLogin(userId) {
  await pool.query(
    `
    UPDATE pd_users
    SET last_web_login = NOW(),
        failed_login_attempts = 0
    WHERE id = $1
    `,
    [userId]
  );
}

async function increaseFailedLogin(userId) {
  await pool.query(
    `
    UPDATE pd_users
    SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1
    WHERE id = $1
    `,
    [userId]
  );
}

async function createWebUser(username, usernameLower, passwordHash, ip) {
  const result = await pool.query(
    `
    INSERT INTO pd_users
      (username, username_lower, password_hash, registered_from, last_ip, last_web_login)
    VALUES ($1, $2, $3, 'WEB', $4, CURRENT_TIMESTAMP)
    RETURNING
      id,
      username AS nickname,
      role,
      auto_login_enabled,
      admin_panel_enabled,
      pin_hash
    `,
    [username, usernameLower, passwordHash, ip]
  );

  return result.rows[0];
}

async function createWhitelistRequest(userId, username, usernameLower) {
  await pool.query(
    `
    INSERT INTO moderation_whitelist_requests
      (user_id, player_name, player_name_lower, status)
    VALUES ($1, $2, $3, 'PENDING')
    ON CONFLICT (player_name_lower) WHERE status = 'PENDING'
    DO NOTHING
    `,
    [userId, username, usernameLower]
  );
}

module.exports = {
  findByNickname,
  findAuthByNickname,
  updateLastWebLogin,
  increaseFailedLogin,
  createWebUser,
  createWhitelistRequest,
};
