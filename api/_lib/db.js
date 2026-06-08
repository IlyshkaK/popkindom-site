const { Pool } = require('pg');

const useSsl = String(process.env.DB_SSL || 'true').toLowerCase() === 'true';

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    };

const pool = globalThis.__popkindomPgPool || new Pool(poolConfig);
globalThis.__popkindomPgPool = pool;

async function query(text, params) {
  return pool.query(text, params);
}

let ensurePromise = null;

async function ensureAuthTables() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS pd_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(16) NOT NULL,
        username_lower VARCHAR(16) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        pin_hash TEXT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'PLAYER',
        admin_panel_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        registered_from VARCHAR(16) NOT NULL DEFAULT 'WEB',
        registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_uuid VARCHAR(36),
        last_ip VARCHAR(64),
        last_server_login TIMESTAMP NULL,
        last_web_login TIMESTAMP NULL,
        failed_login_attempts INT NOT NULL DEFAULT 0,
        failed_pin_attempts INT NOT NULL DEFAULT 0,
        locked_until TIMESTAMP NULL,
        pin_locked_until TIMESTAMP NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pd_auth_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES pd_users(id) ON DELETE CASCADE,
        session_type VARCHAR(32) NOT NULL,
        ip_address VARCHAR(64) NOT NULL,
        token_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pd_security_logs (
        id SERIAL PRIMARY KEY,
        user_id INT NULL REFERENCES pd_users(id) ON DELETE SET NULL,
        username VARCHAR(16),
        ip_address VARCHAR(64),
        action VARCHAR(64) NOT NULL,
        details TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_pd_users_username_lower ON pd_users(username_lower);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_pd_auth_sessions_lookup ON pd_auth_sessions(user_id, session_type, ip_address, revoked, expires_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_pd_auth_sessions_token ON pd_auth_sessions(token_hash);`);
  })();

  return ensurePromise;
}

module.exports = {
  query,
  ensureAuthTables,
};
