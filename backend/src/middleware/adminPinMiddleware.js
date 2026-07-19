function adminPinRequired(req, res, next) {
  if (
    req.session?.adminPinPassed === true &&
    req.session?.adminPinUserId === req.user?.id
  ) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    code: "PIN_REQUIRED",
    message: "Требуется подтверждение PIN",
  });
}

module.exports = {
  adminPinRequired,
};
