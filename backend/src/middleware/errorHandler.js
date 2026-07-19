const logger = require('../config/logger');

function errorHandler(error, req, res, next) {
  console.error("[API ERROR]", {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(error.status || 500).json({
    ok: false,
    message: error.publicMessage || "Ошибка сервера",
  });
}

module.exports = errorHandler;
