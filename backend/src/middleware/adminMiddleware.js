const { hasRoleAtLeast } = require("../utils/roles");

function adminRequired(req, res, next) {
  const role = req.user?.role;

  if (!hasRoleAtLeast(role, "admin")) {
    return res.status(403).json({
      ok: false,
      message: "Недостаточно прав",
    });
  }

  next();
}

module.exports = {
  adminRequired,
};
