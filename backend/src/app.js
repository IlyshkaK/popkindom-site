const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const topRoutes = require("./routes/topRoutes");
const session = require("express-session");
const userRoutes = require("./routes/userRoutes");
const accountRoutes = require("./routes/accountRoutes");
const titlesRoutes = require("./routes/titlesRoutes");
const pinRoutes = require("./routes/pinRoutes");
const securityRoutes = require("./routes/securityRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pool = require("./database/pool");
const { normalizeRole, hasRoleAtLeast } = require("./utils/roles");

const publicNewsHandler = require("../routes/news/news");
const adminNewsHandler = require("../routes/admin/news-cms");

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

const authController = require("./controllers/authController");
const { authRequired } = require("./middleware/authMiddleware");
const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 30
  }
}));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "PopkinDom API" });
});

app.post("/api/auth/login", authController.login);
app.get("/api/auth/me", authRequired, authController.me);
app.post("/api/auth/logout", authController.logout);

const securityController = require("./controllers/securityController");

app.post("/api/disable-autologin", authRequired, securityController.disableAutoLogin);
app.post("/api/logout-all", authRequired, authController.logoutAll);

// Legacy frontend API aliases
app.post("/api/login", authController.login);
app.post("/api/register", authController.register);
app.get("/api/me", authRequired, authController.me);
app.post("/api/logout", authController.logout);

app.use("/api/users", userRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/account/titles", titlesRoutes);
app.use("/api/pin", pinRoutes);
app.use("/api/security", securityRoutes);
app.get("/api/news", asyncRoute(publicNewsHandler));
app.all("/api/admin/news", authRequired, asyncRoute(adminNewsHandler));

app.use("/api/admin", adminRoutes);
app.use("/api/top", topRoutes);

app.get("/api/admin-status", authRequired, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `
    SELECT u.role,
      (
        SELECT t.standard_title
        FROM pd_player_titles t
        WHERE LOWER(t.player_name) = LOWER(u.username)
        LIMIT 1
      ) AS standard_title
    FROM pd_users u
    WHERE u.id = $1
    LIMIT 1
    `,
    [req.user.id]
  );
  const account = result.rows[0];
  const role = normalizeRole(account?.standard_title || account?.role || req.user?.role);

  if (account && role !== normalizeRole(account.role)) {
    await pool.query(`UPDATE pd_users SET role = $1 WHERE id = $2`, [role, req.user.id]);
  }

  res.json({
    ok: true,
    user: { ...req.user, role },
    hasAccess: hasRoleAtLeast(role, "moderator"),
  });
}));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
