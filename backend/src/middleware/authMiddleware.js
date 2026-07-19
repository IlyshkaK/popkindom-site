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
      `
      SELECT
        u.id,
        u.username,
        u.role,
        t.standard_title
      FROM pd_users u
      LEFT JOIN players p ON p.auth_user_id = u.id
      LEFT JOIN pd_player_titles t ON t.player_uuid = p.uuid::uuid
      WHERE u.id = $1
      LIMIT 1
      `,
      [payload.id]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Пользователь не найден",
      });
    }

    const effectiveRole = normalizeRole(user.standard_title || user.role);

    if (effectiveRole !== normalizeRole(user.role)) {
      await pool.query(`UPDATE pd_users SET role = $1 WHERE id = $2`, [effectiveRole, user.id]);
    }

    req.user = {
      id: user.id,
      nickname: user.username || payload.nickname,
      role: effectiveRole,
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
