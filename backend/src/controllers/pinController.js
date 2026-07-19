const bcrypt = require("bcryptjs");

const securityRepository = require("../repositories/securityRepository");
const { success, fail } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

function isValidPin(pin) {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

const getStatus = asyncHandler(async (req, res) => {
  const security = await securityRepository.findSecurityByUserId(req.user.id);

  if (!security) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, {
    enabled: Boolean(security.pin_hash),
    lockedUntil: security.pin_locked_until,
    failedAttempts: security.failed_pin_attempts || 0,
  });
});

const setPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!isValidPin(pin)) {
    return fail(res, "PIN должен состоять из 4 цифр", 400);
  }

  const hash = await bcrypt.hash(pin, 10);
  await securityRepository.updatePinHash(req.user.id, hash);

  return success(res, {}, "PIN установлен");
});

const verifyPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!isValidPin(pin)) {
    return fail(res, "PIN должен состоять из 4 цифр", 400);
  }

  const security = await securityRepository.findSecurityByUserId(req.user.id);

  if (!security) {
    return fail(res, "Пользователь не найден", 404);
  }

  if (!security.pin_hash) {
    return fail(res, "PIN не установлен", 400);
  }

  if (security.pin_locked_until && new Date(security.pin_locked_until) > new Date()) {
    return fail(res, "PIN временно заблокирован", 423);
  }

  const valid = await bcrypt.compare(pin, security.pin_hash || "");

  if (!valid) {
    await securityRepository.increaseFailedPin(req.user.id);
    return fail(res, "Неверный PIN", 401);
  }

  await securityRepository.resetFailedPin(req.user.id);

  req.session.adminPinPassed = true;
  req.session.adminPinUserId = req.user.id;

  return success(res, {}, "PIN подтверждён");
});

const disablePin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!isValidPin(pin)) {
    return fail(res, "PIN должен состоять из 4 цифр", 400);
  }

  const security = await securityRepository.findSecurityByUserId(req.user.id);

  if (!security || !security.pin_hash) {
    return fail(res, "PIN не установлен", 400);
  }

  const valid = await bcrypt.compare(pin, security.pin_hash || "");

  if (!valid) {
    return fail(res, "Неверный PIN", 401);
  }

  await securityRepository.clearPin(req.user.id);

  if (req.session) {
    req.session.adminPinPassed = false;
    req.session.adminPinUserId = null;
  }

  return success(res, {}, "PIN отключён");
});

module.exports = {
  getStatus,
  setPin,
  verifyPin,
  disablePin,
};
