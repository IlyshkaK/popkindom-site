const crypto = require('crypto');
const { query } = require('./db');
const { parseCookies, serializeCookie } = require('./http');
const { hashToken, getUserBySession } = require('./security');
const { normalizeRole } = require('./roles');

const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'pd_admin_session';
const ADMIN_SESSION_MINUTES = Number(process.env.ADMIN_SESSION_MINUTES || 30);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true';

function isAdminRole(user) {
  return ['moderator', 'admin', 'spec.admin'].includes(normalizeRole(user?.role));
}

function isFullAdminRole(user) {
  return ['admin', 'spec.admin'].includes(normalizeRole(user?.role));
}

function isOwnerRole(user) {
  return normalizeRole(user?.role) === 'spec.admin';
}

function createToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

function setAdminCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'Lax',
      maxAge: ADMIN_SESSION_MINUTES * 60,
      path: '/',
    })
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(ADMIN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'Lax',
      maxAge: 0,
      path: '/',
    })
  );
}

async function createAdminSession(user, ip, res) {
  const token = createToken();

  await query(
    `INSERT INTO pd_auth_sessions (user_id, session_type, ip_address, token_hash, expires_at)
     VALUES ($1, 'ADMIN_PANEL', $2, $3, CURRENT_TIMESTAMP + ($4 || ' minutes')::INTERVAL);`,
    [user.id, ip, hashToken(token), ADMIN_SESSION_MINUTES]
  );

  setAdminCookie(res, token);
}

async function getAdminUser(req) {
  const user = await getUserBySession(req);

  if (!isAdminRole(user)) return null;

  const token = parseCookies(req)[ADMIN_COOKIE_NAME];

  if (!token) return null;

  const result = await query(
    `SELECT 1
     FROM pd_auth_sessions
     WHERE user_id = $1
       AND session_type = 'ADMIN_PANEL'
       AND token_hash = $2
       AND revoked = FALSE
       AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1;`,
    [user.id, hashToken(token)]
  );

  return result.rows.length ? user : null;
}

module.exports = {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MINUTES,
  isAdminRole,
  isFullAdminRole,
  isOwnerRole,
  isValidPin,
  createAdminSession,
  getAdminUser,
  clearAdminCookie,
};
