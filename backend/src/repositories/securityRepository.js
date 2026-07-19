const pool = require("../database/pool");

async function findSecurityByUserId(userId) {
  const result = await pool.query(
    `
    SELECT
      id,
      username AS nickname,
      role,
      password_hash,
      pin_hash,
      auto_login_enabled,
      admin_panel_enabled,
      last_server_login,
      last_web_login,
      failed_login_attempts,
      failed_pin_attempts,
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

async function setAutoLogin(userId, enabled) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET auto_login_enabled = $2
    WHERE id = $1
    RETURNING auto_login_enabled
    `,
    [userId, enabled]
  );

  return result.rows[0] || null;
}

async function updatePasswordHash(userId, passwordHash) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET password_hash = $2,
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = $1
    RETURNING id
    `,
    [userId, passwordHash]
  );

  return result.rows[0] || null;
}

async function updatePinHash(userId, pinHash) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET pin_hash = $2,
        failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE id = $1
    RETURNING id
    `,
    [userId, pinHash]
  );

  return result.rows[0] || null;
}

async function clearPin(userId) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET pin_hash = NULL,
        failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE id = $1
    RETURNING id
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function increaseFailedPin(userId) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET failed_pin_attempts = COALESCE(failed_pin_attempts, 0) + 1,
        pin_locked_until = CASE
          WHEN COALESCE(failed_pin_attempts, 0) + 1 >= 5
          THEN NOW() + INTERVAL '10 minutes'
          ELSE pin_locked_until
        END
    WHERE id = $1
    RETURNING failed_pin_attempts, pin_locked_until
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function resetFailedPin(userId) {
  const result = await pool.query(
    `
    UPDATE pd_users
    SET failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE id = $1
    RETURNING id
    `,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findSecurityByUserId,
  setAutoLogin,
  updatePasswordHash,
  updatePinHash,
  clearPin,
  increaseFailedPin,
  resetFailedPin,
};
