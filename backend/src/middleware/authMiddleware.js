const jwt = require("jsonwebtoken");
const pool = require("../database/pool");
const { normalizeRole } = require("../utils/roles");

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    const cookieToken = req.cookies?.pd_token;

    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Не авторизован",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT id, username, role FROM pd_users WHERE id = $1 LIMIT 1`,
      [payload.id]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Пользователь не найден",
      });
    }

    req.user = {
      id: user.id,
      nickname: user.username || payload.nickname,
      role: normalizeRole(user.role),
    };

    next();
  } catch (error) {
    if (!error?.name?.startsWith("JsonWebToken") && error?.name !== "TokenExpiredError") {
      return next(error);
    }
    return res.status(401).json({
      ok: false,
      message: "Сессия недействительна",
    });
  }
}

module.exports = {
  authRequired,
};
