const bcrypt = require('bcryptjs');
const { query, ensureAuthTables } = require('../lib/db');
const { sendJson, methodNotAllowed, readJson } = require('../lib/http');
const { getClientIp, getUserBySession, publicUser, logSecurity } = require('../lib/security');
const { isAdminRole, isFullAdminRole, isOwnerRole, isValidPin, createAdminSession, getAdminUser } = require('../lib/admin');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const PLAYER_ACTIONS = new Set(['BAN', 'TEMP_BAN', 'MUTE', 'TEMP_MUTE', 'UNBAN', 'UNMUTE', 'KICK', 'WHITELIST_REMOVE', 'RESET_PASSWORD', 'RESET_PIN', 'PRIVATE_MESSAGE', 'SET_ROLE']);
const MODERATOR_ACTIONS = new Set(['MUTE', 'TEMP_MUTE', 'UNMUTE', 'KICK', 'PRIVATE_MESSAGE']);
const FULL_ADMIN_ACTIONS = new Set(['BAN', 'TEMP_BAN', 'MUTE', 'TEMP_MUTE', 'UNBAN', 'UNMUTE', 'KICK', 'WHITELIST_REMOVE', 'RESET_PASSWORD', 'RESET_PIN', 'PRIVATE_MESSAGE']);
const OWNER_ACTIONS = new Set(['SET_ROLE']);
const ALLOWED_ROLES = new Set(['PLAYER', 'MODERATOR', 'ADMIN', 'OWNER']);

async function safeCount(sql) {
  try {
    const result = await query(sql);
    return Number(result.rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

function parseDurationToDate(raw) {
  const value = String(raw || '').trim().toLowerCase();
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + amount * multipliers[match[2]]);
}


function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = 'PD-';
  for (let i = 0; i < 10; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function normalizeRole(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (['PLAYER', 'MODERATOR', 'ADMIN', 'OWNER'].includes(value)) return value;
  if (value === 'ИГРОК') return 'PLAYER';
  if (value === 'МОДЕРАТОР') return 'MODERATOR';
  if (value === 'АДМИНИСТРАТОР') return 'ADMIN';
  if (value === 'ВЛАДЕЛЕЦ') return 'OWNER';
  return null;
}

function roleRank(raw) {
  const role = normalizeRole(raw) || String(raw || 'PLAYER').trim().toUpperCase();
  return { PLAYER: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 }[role] || 1;
}

function canActOnTargetRole(executorRoleRaw, targetRoleRaw) {
  const executorRole = normalizeRole(executorRoleRaw) || String(executorRoleRaw || '').trim().toUpperCase();
  const targetRole = normalizeRole(targetRoleRaw) || String(targetRoleRaw || 'PLAYER').trim().toUpperCase();

  if (executorRole === 'OWNER') return true;
  if (executorRole === 'ADMIN') return ['PLAYER', 'MODERATOR'].includes(targetRole);
  if (executorRole === 'MODERATOR') return targetRole === 'PLAYER';
  return false;
}

async function getTargetUserByUsername(usernameLower) {
  const result = await query(
    `SELECT id, username, username_lower, role
     FROM pd_users
     WHERE username_lower = $1
     LIMIT 1;`,
    [usernameLower]
  );
  return result.rows[0] || null;
}

async function ensureModerationCommandsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS moderation_commands (
      id BIGSERIAL PRIMARY KEY,
      command_type TEXT NOT NULL,
      player_name TEXT NOT NULL,
      player_name_lower TEXT NOT NULL,
      executor TEXT NOT NULL,
      reason TEXT,
      payload JSONB DEFAULT '{}'::jsonb,
      source TEXT NOT NULL DEFAULT 'WEBSITE',
      delivered BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function queueModerationCommand(commandType, username, usernameLower, executor, reason, payload = {}) {
  await ensureModerationCommandsTable();
  await query(
    `INSERT INTO moderation_commands (command_type, player_name, player_name_lower, executor, reason, payload, source)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'WEBSITE');`,
    [commandType, username, usernameLower, executor, reason, JSON.stringify(payload || {})]
  );
}


async function ensurePlayerMessagesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS moderation_private_messages (
      id BIGSERIAL PRIMARY KEY,
      player_name TEXT NOT NULL,
      player_name_lower TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      delivered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function audit(action, target, executor, details) {
  await query(
    `INSERT INTO moderation_audit_log (action, target_player, executor, details, source)
     VALUES ($1, $2, $3, $4, 'WEBSITE');`,
    [action, target, executor, details]
  );
}

async function requireAdmin(req, res) {
  const admin = await getAdminUser(req);
  if (!admin) {
    sendJson(res, 403, { message: 'Нужно подтвердить вход PIN-кодом.' });
    return null;
  }
  return admin;
}

async function handleStatus(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const user = await getUserBySession(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });
  const verifiedUser = await getAdminUser(req);
  return sendJson(res, 200, {
    user: publicUser(user),
    hasPin: Boolean(user.pin_hash),
    verified: Boolean(verifiedUser),
  });
}

async function handleSetupPin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const user = await getUserBySession(req);
  const ip = getClientIp(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });
  if (user.pin_hash) return sendJson(res, 409, { message: 'PIN уже создан.' });

  const body = await readJson(req);
  const pin = String(body.pin || '');
  const pinRepeat = String(body.pinRepeat || '');

  if (!isValidPin(pin)) return sendJson(res, 400, { message: 'PIN должен состоять из 4 цифр.' });
  if (pin !== pinRepeat) return sendJson(res, 400, { message: 'PIN-коды не совпадают.' });

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await query(
    `UPDATE pd_users
     SET pin_hash = $1,
         failed_pin_attempts = 0,
         pin_locked_until = NULL
     WHERE id = $2;`,
    [pinHash, user.id]
  );

  await createAdminSession(user, ip, res);
  await logSecurity(user, ip, 'ADMIN_PIN_CREATED', 'Создан PIN для входа в админ-панель');
  return sendJson(res, 200, { message: 'PIN создан.', verified: true });
}

async function handleVerifyPin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const user = await getUserBySession(req);
  const ip = getClientIp(req);
  if (!user) return sendJson(res, 401, { message: 'Не авторизован.' });
  if (!isAdminRole(user)) return sendJson(res, 403, { message: 'Недостаточно прав.' });
  if (!user.pin_hash) return sendJson(res, 400, { message: 'Сначала создайте PIN.' });

  if (user.pin_locked_until && new Date(user.pin_locked_until).getTime() > Date.now()) {
    return sendJson(res, 423, { message: 'Ввод PIN временно заблокирован. Попробуйте позже.' });
  }

  const body = await readJson(req);
  const pin = String(body.pin || '');
  if (!isValidPin(pin)) return sendJson(res, 400, { message: 'PIN должен состоять из 4 цифр.' });

  const ok = await bcrypt.compare(pin, user.pin_hash);
  if (!ok) {
    await query(
      `UPDATE pd_users
       SET failed_pin_attempts = failed_pin_attempts + 1,
           pin_locked_until = CASE
             WHEN failed_pin_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + ('15 minutes')::INTERVAL
             ELSE pin_locked_until
           END
       WHERE id = $1;`,
      [user.id]
    );
    await logSecurity(user, ip, 'ADMIN_PIN_FAILED', 'Неверный PIN для входа в админ-панель');
    return sendJson(res, 401, { message: 'Неверный PIN-код.' });
  }

  await query(
    `UPDATE pd_users
     SET failed_pin_attempts = 0,
         pin_locked_until = NULL
     WHERE id = $1;`,
    [user.id]
  );

  await createAdminSession(user, ip, res);
  await logSecurity(user, ip, 'ADMIN_PIN_SUCCESS', 'Вход в админ-панель подтверждён PIN-кодом');
  return sendJson(res, 200, { message: 'Доступ разрешён.', verified: true });
}

async function handleOverview(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const [usersCount, onlineCount, adminCount, whitelistRequestsCount] = await Promise.all([
    safeCount(`SELECT COUNT(*) FROM pd_users;`),
    safeCount(`SELECT COUNT(*) FROM players WHERE online = TRUE;`),
    safeCount(`SELECT COUNT(*) FROM pd_users WHERE role IN ('ADMIN', 'OWNER');`),
    safeCount(`SELECT COUNT(*) FROM moderation_whitelist_requests WHERE status = 'PENDING';`),
  ]);

  let latestPlayers = [];
  try {
    const result = await query(
      `SELECT u.username, u.role, u.registered_at, u.last_web_login, p.online, p.updated_at AS player_updated_at
       FROM pd_users u
       LEFT JOIN players p ON p.auth_user_id = u.id
       ORDER BY COALESCE(u.last_web_login, u.registered_at) DESC
       LIMIT 10;`
    );
    latestPlayers = result.rows;
  } catch {
    const result = await query(
      `SELECT username, role, registered_at, last_web_login, FALSE AS online, NULL AS player_updated_at
       FROM pd_users
       ORDER BY COALESCE(last_web_login, registered_at) DESC
       LIMIT 10;`
    );
    latestPlayers = result.rows;
  }

  return sendJson(res, 200, {
    admin: { username: admin.username, role: admin.role },
    cards: { usersCount, onlineCount, adminCount, whitelistRequestsCount },
    latestPlayers,
  });
}

async function handlePlayers(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const search = String(req.query?.search || '').trim().toLowerCase();
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE LOWER(u.username) LIKE $1`;
  }

  const result = await query(
    `SELECT
       u.id,
       u.username,
       u.username_lower,
       u.role,
       u.registered_at,
       u.last_web_login,
       u.last_server_login,
       p.online,
       p.updated_at AS player_updated_at,
       COALESCE(ps.play_time_ticks, 0) AS play_time_ticks,
       COALESCE(ps.mob_kills, 0) AS mob_kills,
       COALESCE(ps.deaths, 0) AS deaths,
       COALESCE(pb.blocks_total, 0) AS blocks_total,
       EXISTS (SELECT 1 FROM moderation_whitelist wl WHERE wl.player_name_lower = u.username_lower AND wl.active = TRUE) AS whitelisted,
       EXISTS (SELECT 1 FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('BAN', 'TEMP_BAN') AND (mp.expires_at IS NULL OR mp.expires_at > NOW())) AS banned,
       EXISTS (SELECT 1 FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('MUTE', 'TEMP_MUTE') AND (mp.expires_at IS NULL OR mp.expires_at > NOW())) AS muted,
       (SELECT mp.expires_at FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('BAN', 'TEMP_BAN') AND (mp.expires_at IS NULL OR mp.expires_at > NOW()) ORDER BY mp.created_at DESC LIMIT 1) AS ban_expires_at,
       (SELECT mp.expires_at FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('MUTE', 'TEMP_MUTE') AND (mp.expires_at IS NULL OR mp.expires_at > NOW()) ORDER BY mp.created_at DESC LIMIT 1) AS mute_expires_at,
       COALESCE((
         SELECT json_agg(death_row ORDER BY death_row.created_at DESC)
         FROM (
           SELECT death_reason, world_name, x, y, z, created_at
           FROM player_death_history
           WHERE auth_user_id = u.id
           ORDER BY created_at DESC
           LIMIT 3
         ) death_row
       ), '[]'::json) AS recent_deaths
     FROM pd_users u
     LEFT JOIN players p ON p.auth_user_id = u.id
     LEFT JOIN LATERAL (
       SELECT play_time_ticks, mob_kills, deaths
       FROM player_stats
       WHERE auth_user_id = u.id
       ORDER BY updated_at DESC
       LIMIT 1
     ) ps ON TRUE
     LEFT JOIN LATERAL (
       SELECT SUM(amount)::BIGINT AS blocks_total
       FROM player_blocks
       WHERE auth_user_id = u.id
     ) pb ON TRUE
     ${where}
     ORDER BY COALESCE(p.updated_at, u.last_web_login, u.registered_at) DESC
     LIMIT 80;`,
    params
  );

  return sendJson(res, 200, { players: result.rows });
}


async function handlePlayerDetails(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const username = String(req.query?.username || '').trim();
  const usernameLower = username.toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return sendJson(res, 400, { message: 'Некорректный ник игрока.' });
  }

  const result = await query(
    `SELECT
       u.id,
       u.username,
       u.username_lower,
       u.role,
       u.registered_at,
       u.last_web_login,
       u.last_server_login,
       p.online,
       p.updated_at AS player_updated_at,
       COALESCE(ps.play_time_ticks, 0) AS play_time_ticks,
       COALESCE(ps.mob_kills, 0) AS mob_kills,
       COALESCE(ps.deaths, 0) AS deaths,
       COALESCE(pb.blocks_total, 0) AS blocks_total,
       EXISTS (SELECT 1 FROM moderation_whitelist wl WHERE wl.player_name_lower = u.username_lower AND wl.active = TRUE) AS whitelisted,
       EXISTS (SELECT 1 FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('BAN', 'TEMP_BAN') AND (mp.expires_at IS NULL OR mp.expires_at > NOW())) AS banned,
       EXISTS (SELECT 1 FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('MUTE', 'TEMP_MUTE') AND (mp.expires_at IS NULL OR mp.expires_at > NOW())) AS muted,
       (SELECT mp.expires_at FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('BAN', 'TEMP_BAN') AND (mp.expires_at IS NULL OR mp.expires_at > NOW()) ORDER BY mp.created_at DESC LIMIT 1) AS ban_expires_at,
       (SELECT mp.expires_at FROM moderation_punishments mp WHERE mp.player_name_lower = u.username_lower AND mp.active = TRUE AND mp.type IN ('MUTE', 'TEMP_MUTE') AND (mp.expires_at IS NULL OR mp.expires_at > NOW()) ORDER BY mp.created_at DESC LIMIT 1) AS mute_expires_at,
       COALESCE((
         SELECT json_agg(death_row ORDER BY death_row.created_at DESC)
         FROM (
           SELECT death_reason, world_name, x, y, z, created_at
           FROM player_death_history
           WHERE auth_user_id = u.id
           ORDER BY created_at DESC
           LIMIT 3
         ) death_row
       ), '[]'::json) AS recent_deaths
     FROM pd_users u
     LEFT JOIN players p ON p.auth_user_id = u.id
     LEFT JOIN LATERAL (
       SELECT play_time_ticks, mob_kills, deaths
       FROM player_stats
       WHERE auth_user_id = u.id
       ORDER BY updated_at DESC
       LIMIT 1
     ) ps ON TRUE
     LEFT JOIN LATERAL (
       SELECT SUM(amount)::BIGINT AS blocks_total
       FROM player_blocks
       WHERE auth_user_id = u.id
     ) pb ON TRUE
     WHERE u.username_lower = $1
     LIMIT 1;`,
    [usernameLower]
  );

  const player = result.rows[0] || null;
  if (!player) return sendJson(res, 404, { message: 'Игрок не найден.' });
  return sendJson(res, 200, { player });
}

async function handlePlayerHistory(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const username = String(req.query?.username || '').trim();
  const usernameLower = username.toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return sendJson(res, 400, { message: 'Некорректный ник игрока.' });
  }

  const result = await query(
    `SELECT id, player_name, type, reason, moderator_name, created_at, expires_at, active, removed_by, removed_at, remove_reason, source
     FROM moderation_punishments
     WHERE player_name_lower = $1
     ORDER BY created_at DESC
     LIMIT 30;`,
    [usernameLower]
  );
  return sendJson(res, 200, { history: result.rows });
}

async function handlePlayerAction(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const body = await readJson(req);
  const username = String(body.username || '').trim();
  const usernameLower = username.toLowerCase();
  const action = String(body.action || '').trim().toUpperCase();
  const reason = String(body.reason || '').trim() || 'Действие выполнено через админ-панель сайта';
  const durationRaw = String(body.duration || '').trim();
  const messageText = String(body.message || body.privateMessage || '').trim();
  const newRole = normalizeRole(body.role || body.newRole);

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return sendJson(res, 400, { message: 'Некорректный ник игрока.' });
  }

  if (!PLAYER_ACTIONS.has(action)) {
    return sendJson(res, 400, { message: 'Неизвестное действие.' });
  }

  const adminRole = String(admin.role || '').toUpperCase();

  if (adminRole === 'MODERATOR' && !MODERATOR_ACTIONS.has(action)) {
    return sendJson(res, 403, { message: 'Модератор может выдавать мут, временный мут, снимать мут, кикать и писать игрокам.' });
  }

  if (['ADMIN', 'OWNER'].includes(adminRole) && !FULL_ADMIN_ACTIONS.has(action) && !OWNER_ACTIONS.has(action)) {
    return sendJson(res, 403, { message: 'Недостаточно прав для этого действия.' });
  }

  if (OWNER_ACTIONS.has(action) && !isOwnerRole(admin)) {
    return sendJson(res, 403, { message: 'Выдавать роли может только OWNER.' });
  }

  const targetUser = await getTargetUserByUsername(usernameLower);
  if (!targetUser) {
    return sendJson(res, 404, { message: 'Игрок не найден на сайте.' });
  }

  const adminUsernameLower = String(admin.username_lower || admin.username || '').toLowerCase();
  if (String(targetUser.username_lower || '').toLowerCase() === adminUsernameLower || Number(targetUser.id) === Number(admin.id)) {
    return sendJson(res, 403, { message: 'Нельзя выполнять действия над своим аккаунтом.' });
  }

  if (!canActOnTargetRole(adminRole, targetUser.role)) {
    if (adminRole === 'ADMIN') {
      return sendJson(res, 403, { message: 'ADMIN может работать только с MODERATOR и PLAYER.' });
    }
    if (adminRole === 'MODERATOR') {
      return sendJson(res, 403, { message: 'MODERATOR может работать только с PLAYER.' });
    }
    return sendJson(res, 403, { message: 'Недостаточно прав для выбранного игрока.' });
  }

  if (action === 'SET_ROLE') {
    if (!newRole || !ALLOWED_ROLES.has(newRole)) {
      return sendJson(res, 400, { message: 'Выберите корректную роль: PLAYER, MODERATOR, ADMIN или OWNER.' });
    }

    const result = await query(
      `UPDATE pd_users
       SET role = $1
       WHERE username_lower = $2
       RETURNING username, role;`,
      [newRole, usernameLower]
    );

    if (!result.rows.length) {
      return sendJson(res, 404, { message: 'Игрок не найден на сайте.' });
    }

    await audit('SET_ROLE', username, admin.username, `Роль изменена на ${newRole}`);
    return sendJson(res, 200, { message: `Роль игрока ${username} изменена на ${newRole}.`, role: newRole });
  }

  if (action === 'RESET_PASSWORD') {
    if (!isFullAdminRole(admin)) {
      return sendJson(res, 403, { message: 'Сброс пароля доступен только ADMIN и OWNER.' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    const result = await query(
      `UPDATE pd_users
       SET password_hash = $1
       WHERE username_lower = $2
       RETURNING username;`,
      [passwordHash, usernameLower]
    );

    if (!result.rows.length) {
      return sendJson(res, 404, { message: 'Игрок не найден на сайте.' });
    }

    await query(
      `UPDATE pd_auth_sessions
       SET revoked = TRUE
       WHERE user_id = (SELECT id FROM pd_users WHERE username_lower = $1);`,
      [usernameLower]
    );

    await audit('RESET_PASSWORD', username, admin.username, 'Сброшен пароль игрока через админ-панель');
    return sendJson(res, 200, {
      message: `Пароль игрока ${username} сброшен. Новый временный пароль: ${tempPassword}`,
      temporaryPassword: tempPassword
    });
  }

  if (action === 'RESET_PIN') {
    if (!isFullAdminRole(admin)) {
      return sendJson(res, 403, { message: 'Сброс PIN доступен только ADMIN и OWNER.' });
    }

    const result = await query(
      `UPDATE pd_users
       SET pin_hash = NULL,
           failed_pin_attempts = 0,
           pin_locked_until = NULL
       WHERE username_lower = $1
       RETURNING username;`,
      [usernameLower]
    );

    if (!result.rows.length) {
      return sendJson(res, 404, { message: 'Игрок не найден на сайте.' });
    }

    await query(
      `UPDATE pd_auth_sessions
       SET revoked = TRUE
       WHERE user_id = (SELECT id FROM pd_users WHERE username_lower = $1)
         AND session_type = 'ADMIN_PANEL';`,
      [usernameLower]
    );

    await audit('RESET_PIN', username, admin.username, 'Сброшен PIN игрока через админ-панель');
    return sendJson(res, 200, { message: `PIN-код игрока ${username} сброшен.` });
  }

  if (action === 'PRIVATE_MESSAGE') {
    if (!messageText) {
      return sendJson(res, 400, { message: 'Введите текст личного сообщения.' });
    }

    await ensurePlayerMessagesTable();
    await query(
      `INSERT INTO moderation_private_messages (player_name, player_name_lower, sender_name, message)
       VALUES ($1, $2, $3, $4);`,
      [username, usernameLower, admin.username, messageText]
    );

    await audit('PRIVATE_MESSAGE', username, admin.username, messageText);
    return sendJson(res, 200, { message: `Личное сообщение для ${username} сохранено в очереди.` });
  }

  let expiresAt = null;
  if (['TEMP_BAN', 'TEMP_MUTE'].includes(action)) {
    expiresAt = parseDurationToDate(durationRaw);
    if (!expiresAt) return sendJson(res, 400, { message: 'Укажите срок в формате 10m, 2h или 7d.' });
  }

  if (action === 'KICK') {
    await audit('KICK', username, admin.username, reason);
    await queueModerationCommand('KICK', username, usernameLower, admin.username, reason);
    return sendJson(res, 200, { message: `Команда KICK для ${username} отправлена.` });
  }

  if (action === 'WHITELIST_REMOVE') {
    await query(`DELETE FROM moderation_whitelist WHERE player_name_lower = $1;`, [usernameLower]);
    await audit(action, username, admin.username, reason);
    return sendJson(res, 200, { message: `${username} удалён из whitelist.` });
  }

  if (action === 'UNBAN') {
    await query(
      `UPDATE moderation_punishments
       SET active = FALSE, removed_by = $2, removed_at = CURRENT_TIMESTAMP, remove_reason = $3
       WHERE player_name_lower = $1 AND active = TRUE AND type IN ('BAN', 'TEMP_BAN');`,
      [usernameLower, admin.username, reason]
    );
    await audit(action, username, admin.username, reason);
    await queueModerationCommand('UNBAN', username, usernameLower, admin.username, reason);
    return sendJson(res, 200, { message: `Бан игрока ${username} снят.` });
  }

  if (action === 'UNMUTE') {
    await query(
      `UPDATE moderation_punishments
       SET active = FALSE, removed_by = $2, removed_at = CURRENT_TIMESTAMP, remove_reason = $3
       WHERE player_name_lower = $1 AND active = TRUE AND type IN ('MUTE', 'TEMP_MUTE');`,
      [usernameLower, admin.username, reason]
    );
    await audit(action, username, admin.username, reason);
    await queueModerationCommand('UNMUTE', username, usernameLower, admin.username, reason);
    return sendJson(res, 200, { message: `Мут игрока ${username} снят.` });
  }

  await query(
    `INSERT INTO moderation_punishments
     (player_name, player_name_lower, type, reason, moderator_name, moderator_uuid, expires_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'WEBSITE');`,
    [username, usernameLower, action, reason, admin.username, String(admin.id), expiresAt]
  );
  await audit(action, username, admin.username, reason);
  await queueModerationCommand(action, username, usernameLower, admin.username, reason, {
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    duration: durationRaw || null
  });
  return sendJson(res, 200, { message: `Действие ${action} для ${username} выполнено.` });
}

async function handleWhitelistRequests(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!isFullAdminRole(admin)) return sendJson(res, 403, { message: 'Whitelist доступен только ADMIN и OWNER.' });

  if (req.method === 'GET') {
    const result = await query(
      `SELECT r.id, r.player_name, r.player_name_lower, r.status, r.created_at, u.role, u.last_web_login
       FROM moderation_whitelist_requests r
       LEFT JOIN pd_users u ON u.id = r.user_id
       WHERE r.status = 'PENDING'
       ORDER BY r.created_at ASC
       LIMIT 80;`
    );
    return sendJson(res, 200, { requests: result.rows });
  }

  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = await readJson(req);
  const id = Number(body.id);
  const decision = String(body.decision || '').trim().toUpperCase();
  const reason = String(body.reason || '').trim() || 'Решение администрации сайта';

  if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { message: 'Некорректная заявка.' });
  if (!['APPROVE', 'REJECT'].includes(decision)) return sendJson(res, 400, { message: 'Некорректное решение.' });

  const requestResult = await query(
    `SELECT * FROM moderation_whitelist_requests WHERE id = $1 AND status = 'PENDING' LIMIT 1;`,
    [id]
  );
  const request = requestResult.rows[0];
  if (!request) return sendJson(res, 404, { message: 'Активная заявка не найдена.' });

  if (decision === 'APPROVE') {
    await query(
      `INSERT INTO moderation_whitelist (player_name, player_name_lower, added_by, reason, active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (player_name_lower)
       DO UPDATE SET
         player_name = EXCLUDED.player_name,
         added_by = EXCLUDED.added_by,
         reason = EXCLUDED.reason,
         active = TRUE,
         removed_by = NULL,
         removed_at = NULL;`,
      [request.player_name, request.player_name_lower, admin.username, reason]
    );
  }

  await query(
    `UPDATE moderation_whitelist_requests
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_reason = $4
     WHERE id = $1;`,
    [id, decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', admin.username, reason]
  );
  await audit(decision === 'APPROVE' ? 'WHITELIST_APPROVE' : 'WHITELIST_REJECT', request.player_name, admin.username, reason);
  return sendJson(res, 200, { message: decision === 'APPROVE' ? 'Игрок добавлен в whitelist.' : 'Заявка отклонена.' });
}

module.exports = async function handler(req, res) {
  await ensureAuthTables();
  const section = String(req.query?.section || req.query?.action || '').trim().toLowerCase();

  try {
    if (section === 'status') return handleStatus(req, res);
    if (section === 'setup-pin') return handleSetupPin(req, res);
    if (section === 'verify-pin') return handleVerifyPin(req, res);
    if (section === 'overview') return handleOverview(req, res);
    if (section === 'players') return handlePlayers(req, res);
    if (section === 'player-details') return handlePlayerDetails(req, res);
    if (section === 'player-history') return handlePlayerHistory(req, res);
    if (section === 'player-action') return handlePlayerAction(req, res);
    if (section === 'whitelist-requests') return handleWhitelistRequests(req, res);
    return sendJson(res, 404, { message: 'Неизвестный раздел админ-панели.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Ошибка админ-панели.' });
  }
};
