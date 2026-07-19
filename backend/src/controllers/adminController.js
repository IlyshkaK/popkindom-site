const bcrypt = require("bcryptjs");
const pool = require("../database/pool");
const adminService = require("../services/adminService");

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

function send(res, status, data) {
  return res.status(status).json(data);
}

function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

async function handleSetupPin(req, res, admin) {
  if (admin.pin_hash) {
    return send(res, 409, { ok: false, message: "PIN уже создан." });
  }

  const pin = String(req.body.pin || "");
  const pinRepeat = String(req.body.pinRepeat || "");

  if (!isValidPin(pin)) {
    return send(res, 400, { ok: false, message: "PIN должен состоять из 4 цифр." });
  }

  if (pin !== pinRepeat) {
    return send(res, 400, { ok: false, message: "PIN-коды не совпадают." });
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);

  await pool.query(
    `
    UPDATE pd_users
    SET pin_hash = $1,
        failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE id = $2
    `,
    [pinHash, admin.id]
  );

  req.session.adminPinPassed = true;
  req.session.adminPinUserId = admin.id;

  return send(res, 200, {
    ok: true,
    message: "PIN создан.",
    verified: true,
  });
}

async function handleVerifyPin(req, res, admin) {
  if (!admin.pin_hash) {
    return send(res, 400, { ok: false, message: "Сначала создайте PIN." });
  }

  if (admin.pin_locked_until && new Date(admin.pin_locked_until) > new Date()) {
    return send(res, 423, {
      ok: false,
      message: "Ввод PIN временно заблокирован. Попробуйте позже.",
    });
  }

  const pin = String(req.body.pin || "");

  if (!isValidPin(pin)) {
    return send(res, 400, { ok: false, message: "PIN должен состоять из 4 цифр." });
  }

  const ok = await bcrypt.compare(pin, admin.pin_hash);

  if (!ok) {
    await pool.query(
      `
      UPDATE pd_users
      SET failed_pin_attempts = COALESCE(failed_pin_attempts, 0) + 1,
          pin_locked_until = CASE
            WHEN COALESCE(failed_pin_attempts, 0) + 1 >= 5
            THEN NOW() + INTERVAL '10 minutes'
            ELSE pin_locked_until
          END
      WHERE id = $1
      `,
      [admin.id]
    );

    return send(res, 401, { ok: false, message: "Неверный PIN-код." });
  }

  await pool.query(
    `
    UPDATE pd_users
    SET failed_pin_attempts = 0,
        pin_locked_until = NULL
    WHERE id = $1
    `,
    [admin.id]
  );

  req.session.adminPinPassed = true;
  req.session.adminPinUserId = admin.id;

  return send(res, 200, {
    ok: true,
    message: "Доступ разрешён.",
    verified: true,
  });
}

async function requireAdmin(req, res) {
  const admin = await adminService.getAdminUser(req.user.id);

  if (!admin) {
    send(res, 403, { ok: false, message: "Недостаточно прав" });
    return null;
  }

  return admin;
}

async function requireVerifiedAdmin(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;

  const verified =
    req.session?.adminPinPassed === true &&
    Number(req.session?.adminPinUserId) === Number(admin.id);

  if (!verified) {
    send(res, 403, {
      ok: false,
      code: "PIN_REQUIRED",
      message: "Нужно подтвердить вход PIN-кодом.",
    });
    return null;
  }

  return admin;
}

async function handleAdmin(req, res) {
  try {
    const section = String(req.query.section || req.query.action || "").trim().toLowerCase();

    if (section === "status") {
      const result = await adminService.getStatus(req.user.id, req.session);
      if (!result.ok) return send(res, result.status || 403, { ok: false, message: result.message });
      return send(res, 200, { ok: true, ...result.data });
    }

    if (section === "setup-pin") {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      return handleSetupPin(req, res, admin);
    }

    if (section === "verify-pin") {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      return handleVerifyPin(req, res, admin);
    }

    const admin = await requireVerifiedAdmin(req, res);
    if (!admin) return;

    if (section === "overview") {
      const data = await adminService.getOverview(admin);
      return send(res, 200, { ok: true, ...data });
    }

    if (section === "players") {
      const data = await adminService.getPlayers(req.query.search || "");
      return send(res, 200, { ok: true, ...data });
    }

    if (section === "player-details") {
      const result = await adminService.getPlayerDetails(req.query.username);
      if (!result.ok) return send(res, result.status, { ok: false, message: result.message });
      return send(res, 200, { ok: true, ...result.data });
    }

    if (section === "player-history") {
      const result = await adminService.getPlayerHistory(req.query.username);
      if (!result.ok) return send(res, result.status, { ok: false, message: result.message });
      return send(res, 200, { ok: true, ...result.data });
    }

    if (section === "player-action") {
      if (req.method !== "POST") {
        return send(res, 405, { ok: false, message: "Метод не разрешён." });
      }

      const result = await adminService.runPlayerAction(admin, req.body);
      if (!result.ok) return send(res, result.status, { ok: false, message: result.message });
      return send(res, 200, { ok: true, ...result.data });
    }

    if (section === "whitelist-requests") {
      if (req.method === "GET") {
        const result = await adminService.getWhitelistRequests(admin);
        if (!result.ok) return send(res, result.status, { ok: false, message: result.message });
        return send(res, 200, { ok: true, ...result.data });
      }

      if (req.method === "POST") {
        const result = await adminService.reviewWhitelistRequest(admin, req.body);
        if (!result.ok) return send(res, result.status, { ok: false, message: result.message });
        return send(res, 200, { ok: true, ...result.data });
      }

      return send(res, 405, { ok: false, message: "Метод не разрешён." });
    }

    return send(res, 404, {
      ok: false,
      message: "Неизвестный раздел админ-панели.",
    });
  } catch (error) {
    console.error("[AdminController]", error);
    return send(res, 500, {
      ok: false,
      message: "Ошибка админ-панели.",
    });
  }
}

module.exports = {
  handleAdmin,
};
