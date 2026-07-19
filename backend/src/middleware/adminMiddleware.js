function adminRequired(req, res, next) {
  const role = req.user?.role;

  if (role !== "ADMIN" && role !== "OWNER") {
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
