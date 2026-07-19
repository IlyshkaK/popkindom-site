function notFoundHandler(req, res) {
  return res.status(404).json({
    ok: false,
    message: "Маршрут не найден",
    path: req.path,
    method: req.method,
  });
}

module.exports = notFoundHandler;
