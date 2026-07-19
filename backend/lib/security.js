const crypto = require('crypto');
const { query } = require('./db');
const { parseCookies, serializeCookie } = require('./http');
const { normalizeRole } = require('./roles');

const COOKIE_NAME = process.env.COOKIE_NAME || 'pd_session';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 48);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function isValidMinecraftNick(username) {
  return /^[a-zA-Z0-9_]{3,16}$/.test(username);
}

function isPasswordStrong(username, password) {
  if (!password || password.length < 8) return false;

  const lowerPassword = password.toLowerCase();
  const lowerUsername = String(username || '').toLowerCase();

  if (lowerUsername && lowerPassword.includes(lowerUsername)) return false;

  const blocked = new Set([
    '12345678',
    '123456789',
    'qwerty123',
    'password',
    'minecraft',
    '11111111',
    '00000000',
  ]);

  return !blocked.has(lowerPassword);
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
    adminPanelEnabled: row.admin_panel_enabled,
    registeredAt: row.registered_at,
    lastServerLogin: row.last_server_login,
    lastWebLogin: row.last_web_login,
  };
}

function setSessionCookie(res, token) {
  const cookie = serializeCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'Lax',
    maxAge: SESSION_HOURS * 60 * 60,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const cookie = serializeCookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
}

async function logSecurity(user, ip, action, details) {
  await query(
    `INSERT INTO pd_security_logs (user_id, username, ip_address, action, details)
     VALUES ($1, $2, $3, $4, $5);`,
    [user?.id || null, user?.username || null, ip, action, details]
  );
}

async function createWebSession(user, ip, res) {
  const token = createToken();
  const tokenHash = hashToken(token);

  await query(
    `INSERT INTO pd_auth_sessions (user_id, session_type, ip_address, token_hash, expires_at)
     VALUES ($1, 'WEB_48H', $2, $3, CURRENT_TIMESTAMP + ($4 || ' hours')::INTERVAL);`,
    [user.id, ip, tokenHash, SESSION_HOURS]
  );

  setSessionCookie(res, token);
}

async function getUserBySession(req) {
  const token = parseCookies(req)[COOKIE_NAME];

  if (!token) return null;

  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT u.*
     FROM pd_auth_sessions s
     JOIN pd_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.session_type = 'WEB_48H'
       AND s.revoked = FALSE
       AND s.expires_at > CURRENT_TIMESTAMP
     LIMIT 1;`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_HOURS,
  hashToken,
  getClientIp,
  isValidMinecraftNick,
  isPasswordStrong,
  publicUser,
  createWebSession,
  getUserBySession,
  logSecurity,
  clearSessionCookie,
};
