const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
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

    req.user = {
      id: payload.id,
      nickname: payload.nickname,
      role: payload.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Сессия недействительна",
    });
  }
}

module.exports = {
  authRequired,
};
