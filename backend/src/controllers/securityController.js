const securityService = require("../services/securityService");
const { success, fail } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getSecurity = asyncHandler(async (req, res) => {
  const data = await securityService.getSecurity(req.user.id);

  if (!data) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, data);
});

const toggleAutoLogin = asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return fail(res, "Поле enabled должно быть boolean", 400);
  }

  const data = await securityService.updateAutoLogin(req.user.id, enabled);

  if (!data) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, data, enabled ? "Автовход включён" : "Автовход отключён");
});

const disableAutoLogin = asyncHandler(async (req, res) => {
  const data = await securityService.disableAutoLogin(req.user.id);

  if (!data) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, data, "Автовход отключён");
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return fail(res, "Введите текущий и новый пароль", 400);
  }

  const result = await securityService.changePassword(
    req.user.id,
    currentPassword,
    newPassword
  );

  if (!result.ok) {
    return fail(res, result.message, result.status);
  }

  return success(res, {}, "Пароль изменён");
});

const legacySecurityPost = asyncHandler(async (req, res) => {
  const action = req.query.action;

  if (action === "reset-password") {
    const { pin, password, passwordRepeat } = req.body;

    const result = await securityService.resetPasswordByPin(
      req.user.id,
      pin,
      password,
      passwordRepeat
    );

    if (!result.ok) {
      return fail(res, result.message, result.status);
    }

    return success(res, { logout: true }, "Пароль сброшен. Выполните вход заново.");
  }

  const data = await securityService.getSecurity(req.user.id);

  if (!data) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, data);
});

module.exports = {
  getSecurity,
  toggleAutoLogin,
  disableAutoLogin,
  changePassword,
  legacySecurityPost,
};
