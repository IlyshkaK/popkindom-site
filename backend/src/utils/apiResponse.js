function success(res, data = {}, message = null, status = 200) {
  return res.status(status).json({
    ok: true,
    ...(message ? { message } : {}),
    ...data,
  });
}

function fail(res, message = "Ошибка запроса", status = 400, details = null) {
  return res.status(status).json({
    ok: false,
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = {
  success,
  fail,
};
