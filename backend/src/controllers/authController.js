const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const accountService = require("../services/accountService");
const userRepository = require("../repositories/userRepository");
const { success, fail } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { normalizeRole } = require("../utils/roles");

function isValidMinecraftNick(username) {
  return /^[a-zA-Z0-9_]{3,16}$/.test(String(username || ""));
}

function isPasswordStrong(username, password) {
  const pass = String(password || "");
  const nick = String(username || "").toLowerCase();

  if (pass.length < 8 || pass.length > 64) return false;
  if (nick && pass.toLowerCase().includes(nick)) return false;

  const weak = ["password", "qwerty", "123456", "12345678", "11111111", "minecraft"];
  if (weak.includes(pass.toLowerCase())) return false;

  return true;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nickname: user.nickname,
      role: normalizeRole(user.role),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie("pd_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const register = asyncHandler(async (req, res) => {
  const username = String(req.body.username || req.body.nickname || "").trim();
  const password = String(req.body.password || "");
  const usernameLower = username.toLowerCase();

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  if (!isValidMinecraftNick(username)) {
    return fail(res, "Ник должен быть 3–16 символов: буквы, цифры и _.", 400);
  }

  if (!isPasswordStrong(username, password)) {
    return fail(res, "Пароль слишком слабый. Минимум 8 символов, нельзя использовать ник и простые пароли.", 400);
  }

  const existing = await userRepository.findAuthByNickname(username);

  if (existing) {
    return fail(res, "Аккаунт с таким ником уже существует.", 409);
  }

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const user = await userRepository.createWebUser(username, usernameLower, passwordHash, ip);

  await userRepository.createWhitelistRequest(user.id, username, usernameLower);

  const token = createToken(user);
  setAuthCookie(res, token);

  return success(res, {
    token,
    user: {
      id: user.id,
      username: user.nickname,
      nickname: user.nickname,
      role: normalizeRole(user.role),
      autoLoginEnabled: user.auto_login_enabled,
      adminPanelEnabled: user.admin_panel_enabled,
      hasPin: Boolean(user.pin_hash),
    },
  }, "Аккаунт создан");
});

const login = asyncHandler(async (req, res) => {
  const nickname = req.body.nickname || req.body.username;
  const { password } = req.body;

  if (!nickname || !password) {
    return fail(res, "Введите никнейм и пароль", 400);
  }

  const user = await userRepository.findAuthByNickname(nickname.trim());

  if (!user) {
    return fail(res, "Неверный никнейм или пароль", 401);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return fail(res, "Аккаунт временно заблокирован", 423);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash || "");

  if (!passwordOk) {
    await userRepository.increaseFailedLogin(user.id);
    return fail(res, "Неверный никнейм или пароль", 401);
  }

  await userRepository.updateLastWebLogin(user.id);

  const token = createToken(user);
  setAuthCookie(res, token);

  return success(res, {
    token,
    user: {
      id: user.id,
      username: user.nickname,
      nickname: user.nickname,
      role: normalizeRole(user.role),
      autoLoginEnabled: user.auto_login_enabled,
      adminPanelEnabled: user.admin_panel_enabled,
      hasPin: Boolean(user.pin_hash),
    },
  }, "Вход выполнен");
});

const me = asyncHandler(async (req, res) => {
  const accountData = await accountService.getAccount(req.user.id);

  if (!accountData) {
    return fail(res, "Пользователь не найден", 404);
  }

  return success(res, accountData);
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("pd_token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return success(res, {}, "Выход выполнен");
});

const logoutAll = asyncHandler(async (req, res) => {
  res.clearCookie("pd_token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return success(res, { logout: true }, "Все сессии завершены");
});

module.exports = {
  register,
  login,
  me,
  logout,
  logoutAll,
};
