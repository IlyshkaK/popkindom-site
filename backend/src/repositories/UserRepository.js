const pool = require('../database/pool');

async function findByUsername(username) {
  const result = await pool.query(
    `
    SELECT *
    FROM pd_users
    WHERE username_lower = LOWER($1)
    LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM pd_users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createUser({ username, passwordHash, ipAddress }) {
  const result = await pool.query(
    `
    INSERT INTO pd_users (
      username,
      username_lower,
      password_hash,
      role,
      registered_from,
      registered_at,
      last_ip,
      failed_login_attempts,
      failed_pin_attempts,
      auto_login_enabled
    )
    VALUES (
      $1,
      LOWER($1),
      $2,
      'default',
      'site',
      NOW(),
      $3,
      0,
      0,
      true
    )
    RETURNING *
    `,
    [username, passwordHash, ipAddress]
  );

  return result.rows[0];
}

async function updateLastWebLogin(userId, ipAddress) {
  await pool.query(
    `
    UPDATE pd_users
    SET last_web_login = NOW(),
        last_ip = $2,
        failed_login_attempts = 0
    WHERE id = $1
    `,
    [userId, ipAddress]
  );
}

module.exports = {
  findByUsername,
  findById,
  createUser,
  updateLastWebLogin
};
