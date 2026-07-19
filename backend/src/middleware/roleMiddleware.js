function requireRole(...allowedRoles) {
  return function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: "Не авторизован",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        message: "Недостаточно прав",
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
