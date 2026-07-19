const bcrypt = require("bcryptjs");
const adminRepository = require("../repositories/adminRepository");

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const PLAYER_ACTIONS = new Set([
  "BAN", "TEMP_BAN", "MUTE", "TEMP_MUTE", "UNBAN", "UNMUTE", "KICK",
  "WHITELIST_REMOVE", "RESET_PASSWORD", "RESET_PIN", "PRIVATE_MESSAGE", "SET_ROLE"
]);

const MODERATOR_ACTIONS = new Set(["MUTE", "TEMP_MUTE", "UNMUTE", "KICK", "PRIVATE_MESSAGE"]);
const FULL_ADMIN_ACTIONS = new Set([
  "BAN", "TEMP_BAN", "MUTE", "TEMP_MUTE", "UNBAN", "UNMUTE", "KICK",
  "WHITELIST_REMOVE", "RESET_PASSWORD", "RESET_PIN", "PRIVATE_MESSAGE"
]);
const OWNER_ACTIONS = new Set(["SET_ROLE"]);
const ALLOWED_ROLES = new Set(["PLAYER", "MODERATOR", "ADMIN", "OWNER"]);

function isAdminRole(user) {
  return ["MODERATOR", "ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());
}

function isFullAdminRole(user) {
  return ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());
}

function isOwnerRole(user) {
  return String(user?.role || "").toUpperCase() === "OWNER";
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.username,
    role: user.role,
    autoLoginEnabled: user.auto_login_enabled,
    adminPanelEnabled: user.admin_panel_enabled,
    hasPin: Boolean(user.pin_hash),
  };
}

function normalizeRole(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (ALLOWED_ROLES.has(value)) return value;
  if (value === "ИГРОК") return "PLAYER";
  if (value === "МОДЕРАТОР") return "MODERATOR";
  if (value === "АДМИНИСТРАТОР") return "ADMIN";
  if (value === "ВЛАДЕЛЕЦ") return "OWNER";
  return null;
}

function canActOnTargetRole(executorRoleRaw, targetRoleRaw) {
  const executorRole = normalizeRole(executorRoleRaw) || "PLAYER";
  const targetRole = normalizeRole(targetRoleRaw) || "PLAYER";

  if (executorRole === "OWNER") return true;
  if (executorRole === "ADMIN") return ["PLAYER", "MODERATOR"].includes(targetRole);
  if (executorRole === "MODERATOR") return targetRole === "PLAYER";
  return false;
}

function parseDurationToDate(raw) {
  const value = String(raw || "").trim().toLowerCase();
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + amount * multipliers[match[2]]);
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "PD-";
  for (let i = 0; i < 10; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

async function getAdminUser(userId) {
  const user = await adminRepository.findUserById(userId);
  if (!user || !isAdminRole(user)) return null;
  return user;
}

async function getStatus(userId, session) {
  const user = await getAdminUser(userId);

  if (!user) {
    return { ok: false, status: 403, message: "Недостаточно прав" };
  }

  return {
    ok: true,
    data: {
      user: publicUser(user),
      hasPin: Boolean(user.pin_hash),
      verified:
        session?.adminPinPassed === true &&
        Number(session?.adminPinUserId) === Number(user.id),
    },
  };
}

async function getOverview(admin) {
  const [usersCount, onlineCount, adminCount, whitelistRequestsCount] = await Promise.all([
    adminRepository.countUsers(),
    adminRepository.countOnline(),
    adminRepository.countAdmins(),
    adminRepository.countPendingWhitelist(),
  ]);

  return {
    admin: {
      username: admin.username,
      role: admin.role,
    },
    cards: {
      usersCount,
      onlineCount,
      adminCount,
      whitelistRequestsCount,
    },
  };
}

async function getPlayers(search) {
  const players = await adminRepository.findPlayers(search);
  return { players };
}

async function getPlayerDetails(username) {
  const cleanUsername = String(username || "").trim();
  const usernameLower = cleanUsername.toLowerCase();

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanUsername)) {
    return { ok: false, status: 400, message: "Некорректный ник игрока." };
  }

  const player = await adminRepository.findPlayerDetails(usernameLower);

  if (!player) {
    return { ok: false, status: 404, message: "Игрок не найден." };
  }

  const [stats, blocksTotal, recentDeaths, activePunishments] = await Promise.all([
    adminRepository.findPlayerStats(player.id, player.uuid),
    adminRepository.findPlayerBlocksTotal(player.id, player.uuid),
    adminRepository.findRecentDeaths(player.id, player.uuid, 3),
    adminRepository.findActivePunishments(usernameLower),
  ]);

  const activeBan = activePunishments.find((item) => ["BAN", "TEMP_BAN"].includes(String(item.type || "").toUpperCase()));
  const activeMute = activePunishments.find((item) => ["MUTE", "TEMP_MUTE"].includes(String(item.type || "").toUpperCase()));

  const mergedPlayer = {
    ...player,
    stats,
    player_stats: stats,
    blocks_total: blocksTotal,
    blocks_mined: blocksTotal,
    recent_deaths: recentDeaths,
    recentDeaths,
    active_punishments: activePunishments,
    activePunishments,
    banned: Boolean(player.banned || activeBan),
    muted: Boolean(player.muted || activeMute),
    active_ban: Boolean(activeBan),
    active_mute: Boolean(activeMute),
    hasActivePunishments: activePunishments.length > 0,
    ban_expires_at: activeBan?.expires_at || player.ban_expires_at || null,
    mute_expires_at: activeMute?.expires_at || player.mute_expires_at || null,
  };

  return {
    ok: true,
    data: {
      player: mergedPlayer,
      stats,
      blocksTotal,
      recentDeaths,
      activePunishments,
    },
  };
}

async function getPlayerHistory(username) {
  const cleanUsername = String(username || "").trim();

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanUsername)) {
    return { ok: false, status: 400, message: "Некорректный ник игрока." };
  }

  const history = await adminRepository.findPlayerHistory(cleanUsername.toLowerCase());
  return { ok: true, data: { history } };
}

async function runPlayerAction(admin, body) {
  const username = String(body.username || "").trim();
  const usernameLower = username.toLowerCase();
  const action = String(body.action || "").trim().toUpperCase();
  const reason = String(body.reason || "").trim() || "Действие выполнено через админ-панель сайта";
  const durationRaw = String(body.duration || "").trim();
  const messageText = String(body.message || body.privateMessage || "").trim();
  const newRole = normalizeRole(body.role || body.newRole);

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return { ok: false, status: 400, message: "Некорректный ник игрока." };
  }

  if (!PLAYER_ACTIONS.has(action)) {
    return { ok: false, status: 400, message: "Неизвестное действие." };
  }

  const adminRole = String(admin.role || "").toUpperCase();

  if (adminRole === "MODERATOR" && !MODERATOR_ACTIONS.has(action)) {
    return {
      ok: false,
      status: 403,
      message: "Модератор может выдавать мут, временный мут, снимать мут, кикать и писать игрокам.",
    };
  }

  if (["ADMIN", "OWNER"].includes(adminRole) && !FULL_ADMIN_ACTIONS.has(action) && !OWNER_ACTIONS.has(action)) {
    return { ok: false, status: 403, message: "Недостаточно прав для этого действия." };
  }

  if (OWNER_ACTIONS.has(action) && !isOwnerRole(admin)) {
    return { ok: false, status: 403, message: "Выдавать роли может только OWNER." };
  }

  const targetUser = await adminRepository.findTargetUser(usernameLower);

  if (!targetUser) {
    return { ok: false, status: 404, message: "Игрок не найден на сайте." };
  }

  if (
    String(targetUser.username_lower || "").toLowerCase() === String(admin.username_lower || "").toLowerCase() ||
    Number(targetUser.id) === Number(admin.id)
  ) {
    return { ok: false, status: 403, message: "Нельзя выполнять действия над своим аккаунтом." };
  }

  if (!canActOnTargetRole(adminRole, targetUser.role)) {
    if (adminRole === "ADMIN") {
      return { ok: false, status: 403, message: "ADMIN может работать только с MODERATOR и PLAYER." };
    }
    if (adminRole === "MODERATOR") {
      return { ok: false, status: 403, message: "MODERATOR может работать только с PLAYER." };
    }
    return { ok: false, status: 403, message: "Недостаточно прав для выбранного игрока." };
  }

  if (action === "SET_ROLE") {
    if (!newRole || !ALLOWED_ROLES.has(newRole)) {
      return { ok: false, status: 400, message: "Выберите корректную роль: PLAYER, MODERATOR, ADMIN или OWNER." };
    }

    await adminRepository.updateRole(usernameLower, newRole);
    await adminRepository.audit("SET_ROLE", username, admin.username, `Роль изменена на ${newRole}`);

    return {
      ok: true,
      data: {
        message: `Роль игрока ${username} изменена на ${newRole}.`,
        role: newRole,
      },
    };
  }

  if (action === "RESET_PASSWORD") {
    if (!isFullAdminRole(admin)) {
      return { ok: false, status: 403, message: "Сброс пароля доступен только ADMIN и OWNER." };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await adminRepository.updatePassword(usernameLower, passwordHash);
    await adminRepository.revokeUserSessions(usernameLower);
    await adminRepository.audit("RESET_PASSWORD", username, admin.username, "Сброшен пароль игрока через админ-панель");

    return {
      ok: true,
      data: {
        message: `Пароль игрока ${username} сброшен. Новый временный пароль: ${tempPassword}`,
        temporaryPassword: tempPassword,
      },
    };
  }

  if (action === "RESET_PIN") {
    if (!isFullAdminRole(admin)) {
      return { ok: false, status: 403, message: "Сброс PIN доступен только ADMIN и OWNER." };
    }

    await adminRepository.resetPin(usernameLower);
    await adminRepository.revokeUserSessions(usernameLower, "ADMIN_PANEL");
    await adminRepository.audit("RESET_PIN", username, admin.username, "Сброшен PIN игрока через админ-панель");

    return {
      ok: true,
      data: {
        message: `PIN-код игрока ${username} сброшен.`,
      },
    };
  }

  if (action === "PRIVATE_MESSAGE") {
    if (!messageText) {
      return { ok: false, status: 400, message: "Введите текст личного сообщения." };
    }

    await adminRepository.insertPrivateMessage(username, usernameLower, admin.username, messageText);
    await adminRepository.audit("PRIVATE_MESSAGE", username, admin.username, messageText);

    return {
      ok: true,
      data: {
        message: `Личное сообщение для ${username} сохранено в очереди.`,
      },
    };
  }

  let expiresAt = null;

  if (["TEMP_BAN", "TEMP_MUTE"].includes(action)) {
    expiresAt = parseDurationToDate(durationRaw);

    if (!expiresAt) {
      return { ok: false, status: 400, message: "Укажите срок в формате 10m, 2h или 7d." };
    }
  }

  if (action === "KICK") {
    await adminRepository.insertModerationCommand("KICK", username, usernameLower, admin.username, reason);
    await adminRepository.insertSiteAction("KICK", username, usernameLower, reason, admin.username, admin.role, targetUser.role, null);
    await adminRepository.audit("KICK", username, admin.username, reason);

    return {
      ok: true,
      data: {
        message: `Команда KICK для ${username} отправлена.`,
      },
    };
  }

  if (action === "WHITELIST_REMOVE") {
    await adminRepository.removeWhitelist(usernameLower);
    await adminRepository.insertSiteAction("WHITELIST_REMOVE", username, usernameLower, reason, admin.username, admin.role, targetUser.role, null);
    await adminRepository.audit("WHITELIST_REMOVE", username, admin.username, reason);

    return {
      ok: true,
      data: {
        message: `${username} удалён из whitelist.`,
      },
    };
  }

  if (action === "UNBAN") {
    await adminRepository.deactivatePunishments(usernameLower, ["BAN", "TEMP_BAN"], admin.username, reason);
    await adminRepository.insertModerationCommand("UNBAN", username, usernameLower, admin.username, reason);
    await adminRepository.insertSiteAction("UNBAN", username, usernameLower, reason, admin.username, admin.role, targetUser.role, null);
    await adminRepository.audit("UNBAN", username, admin.username, reason);

    return {
      ok: true,
      data: {
        message: `Бан игрока ${username} снят.`,
      },
    };
  }

  if (action === "UNMUTE") {
    await adminRepository.deactivatePunishments(usernameLower, ["MUTE", "TEMP_MUTE"], admin.username, reason);
    await adminRepository.insertModerationCommand("UNMUTE", username, usernameLower, admin.username, reason);
    await adminRepository.insertSiteAction("UNMUTE", username, usernameLower, reason, admin.username, admin.role, targetUser.role, null);
    await adminRepository.audit("UNMUTE", username, admin.username, reason);

    return {
      ok: true,
      data: {
        message: `Мут игрока ${username} снят.`,
      },
    };
  }

  await adminRepository.insertPunishment(username, usernameLower, action, reason, admin.username, admin.id, expiresAt);
  await adminRepository.insertModerationCommand(action, username, usernameLower, admin.username, reason, {
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    duration: durationRaw || null,
  });
  await adminRepository.insertSiteAction(action, username, usernameLower, reason, admin.username, admin.role, targetUser.role, expiresAt);
  await adminRepository.audit(action, username, admin.username, reason);

  return {
    ok: true,
    data: {
      message: `Действие ${action} для ${username} выполнено.`,
    },
  };
}

async function getWhitelistRequests(admin) {
  if (!isFullAdminRole(admin)) {
    return { ok: false, status: 403, message: "Whitelist доступен только ADMIN и OWNER." };
  }

  const requests = await adminRepository.findWhitelistRequests();
  return { ok: true, data: { requests } };
}

async function reviewWhitelistRequest(admin, body) {
  if (!isFullAdminRole(admin)) {
    return { ok: false, status: 403, message: "Whitelist доступен только ADMIN и OWNER." };
  }

  const id = Number(body.id);
  const decision = String(body.decision || "").trim().toUpperCase();
  const reason = String(body.reason || "").trim() || "Решение администрации сайта";

  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, status: 400, message: "Некорректная заявка." };
  }

  if (!["APPROVE", "REJECT"].includes(decision)) {
    return { ok: false, status: 400, message: "Некорректное решение." };
  }

  const request = await adminRepository.findWhitelistRequestById(id);

  if (!request) {
    return { ok: false, status: 404, message: "Активная заявка не найдена." };
  }

  if (decision === "APPROVE") {
    await adminRepository.approveWhitelistRequest(request, admin.username, reason);
  }

  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  await adminRepository.reviewWhitelistRequest(id, status, admin.username, reason);
  await adminRepository.audit(
    decision === "APPROVE" ? "WHITELIST_APPROVE" : "WHITELIST_REJECT",
    request.player_name,
    admin.username,
    reason
  );

  return {
    ok: true,
    data: {
      message: decision === "APPROVE" ? "Игрок добавлен в whitelist." : "Заявка отклонена.",
    },
  };
}

module.exports = {
  isAdminRole,
  publicUser,
  getAdminUser,
  getStatus,
  getOverview,
  getPlayers,
  getPlayerDetails,
  getPlayerHistory,
  runPlayerAction,
  getWhitelistRequests,
  reviewWhitelistRequest,
};	
