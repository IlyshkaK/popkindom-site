const bcrypt = require("bcryptjs");
const securityRepository = require("../repositories/securityRepository");
const { normalizeRole } = require("../utils/roles");

function securityPayload(security) {
  return {
    user: {
      id: security.id,
      username: security.nickname,
      nickname: security.nickname,
      role: normalizeRole(security.role),
      hasPin: Boolean(security.pin_hash),
      autoLoginEnabled: security.auto_login_enabled,
      adminPanelEnabled: security.admin_panel_enabled,
    },
    security: {
      autoLoginEnabled: security.auto_login_enabled,
      adminPanelEnabled: security.admin_panel_enabled,
      pinEnabled: Boolean(security.pin_hash),
      hasPin: Boolean(security.pin_hash),
      failedLoginAttempts: security.failed_login_attempts || 0,
      failedPinAttempts: security.failed_pin_attempts || 0,
      lockedUntil: security.locked_until,
      pinLockedUntil: security.pin_locked_until,
      lastServerLogin: security.last_server_login,
      lastWebLogin: security.last_web_login,
    },
    autoLoginEnabled: security.auto_login_enabled,
    adminPanelEnabled: security.admin_panel_enabled,
    hasPin: Boolean(security.pin_hash),
    pinEnabled: Boolean(security.pin_hash),
  };
}

async function getSecurity(userId) {
  const security = await securityRepository.findSecurityByUserId(userId);
  if (!security) return null;
  return securityPayload(security);
}

async function updateAutoLogin(userId, enabled) {
  const updated = await securityRepository.setAutoLogin(userId, Boolean(enabled));
  if (!updated) return null;
  return { autoLoginEnabled: updated.auto_login_enabled };
}

async function disableAutoLogin(userId) {
  return updateAutoLogin(userId, false);
}

async function changePassword(userId, currentPassword, newPassword) {
  const security = await securityRepository.findSecurityByUserId(userId);
  if (!security) return { ok: false, status: 404, message: "Пользователь не найден" };

  const currentOk = await bcrypt.compare(currentPassword, security.password_hash || "");
  if (!currentOk) return { ok: false, status: 401, message: "Текущий пароль указан неверно" };

  if (!newPassword || newPassword.length < 6 || newPassword.length > 64) {
    return { ok: false, status: 400, message: "Новый пароль должен быть от 6 до 64 символов" };
  }

  if (currentPassword === newPassword) {
    return { ok: false, status: 400, message: "Новый пароль не должен совпадать со старым" };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await securityRepository.updatePasswordHash(userId, newHash);
  return { ok: true };
}

async function resetPasswordByPin(userId, pin, password, passwordRepeat) {
  const security = await securityRepository.findSecurityByUserId(userId);

  if (!security) return { ok: false, status: 404, message: "Пользователь не найден" };
  if (!security.pin_hash) return { ok: false, status: 400, message: "PIN не установлен" };

  if (!/^\d{4}$/.test(String(pin || ""))) {
    return { ok: false, status: 400, message: "PIN должен состоять из 4 цифр" };
  }

  if (!password || !passwordRepeat) {
    return { ok: false, status: 400, message: "Введите новый пароль и повтор" };
  }

  if (password !== passwordRepeat) {
    return { ok: false, status: 400, message: "Пароли не совпадают" };
  }

  if (password.length < 6 || password.length > 64) {
    return { ok: false, status: 400, message: "Новый пароль должен быть от 6 до 64 символов" };
  }

  if (security.pin_locked_until && new Date(security.pin_locked_until) > new Date()) {
    return { ok: false, status: 423, message: "PIN временно заблокирован" };
  }

  const pinOk = await bcrypt.compare(String(pin), security.pin_hash || "");

  if (!pinOk) {
    await securityRepository.increaseFailedPin(userId);
    return { ok: false, status: 401, message: "Неверный PIN" };
  }

  const newHash = await bcrypt.hash(password, 10);
  await securityRepository.updatePasswordHash(userId, newHash);
  await securityRepository.resetFailedPin(userId);

  return { ok: true };
}

module.exports = {
  getSecurity,
  updateAutoLogin,
  disableAutoLogin,
  changePassword,
  resetPasswordByPin,
};
