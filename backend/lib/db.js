const { Pool } = require('pg');

const useSsl = String(process.env.DB_SSL || 'true').toLowerCase() === 'true';

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
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
        pin_locked_until TIMESTAMP NULL,
        auto_login_enabled BOOLEAN NOT NULL DEFAULT TRUE
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

    await query(`
      CREATE TABLE IF NOT EXISTS moderation_punishments (
        id BIGSERIAL PRIMARY KEY,
        player_name TEXT NOT NULL,
        player_name_lower TEXT NOT NULL,
        offline_uuid TEXT,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        moderator_name TEXT NOT NULL,
        moderator_uuid TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        removed_by TEXT,
        removed_at TIMESTAMPTZ,
        remove_reason TEXT,
        source TEXT NOT NULL DEFAULT 'WEBSITE'
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_moderation_punishments_player_active
      ON moderation_punishments (player_name_lower, active);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS moderation_whitelist (
        id BIGSERIAL PRIMARY KEY,
        player_name TEXT NOT NULL,
        player_name_lower TEXT NOT NULL UNIQUE,
        offline_uuid TEXT,
        added_by TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        removed_by TEXT,
        removed_at TIMESTAMPTZ
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS moderation_whitelist_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NULL REFERENCES pd_users(id) ON DELETE SET NULL,
        player_name TEXT NOT NULL,
        player_name_lower TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        review_reason TEXT
      );
    `);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_whitelist_requests_pending
      ON moderation_whitelist_requests (player_name_lower)
      WHERE status = 'PENDING';
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS moderation_audit_log (
        id BIGSERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        target_player TEXT,
        executor TEXT NOT NULL,
        details TEXT,
        source TEXT NOT NULL DEFAULT 'WEBSITE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  })();

  return ensurePromise;
}

module.exports = {
  query,
  ensureAuthTables,
  pool,
};
