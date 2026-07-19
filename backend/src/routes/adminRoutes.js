const express = require("express");
const router = express.Router();

const { authRequired } = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

// Вся админ-панель работает через один обработчик.
// Сохраняем совместимость со старым фронтендом.
router.get("/", authRequired, adminController.handleAdmin);
router.post("/", authRequired, adminController.handleAdmin);

// Старые проверки оставляем рабочими
router.get("/check", authRequired, (req, res) => {
  res.json({
    ok: true,
    user: req.user
  });
});

router.get("/secure-check", authRequired, adminController.handleAdmin);

module.exports = router;
