const express = require("express");
const authController = require("../controllers/authController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", authRequired, authController.me);
router.post("/logout", authController.logout);

module.exports = router;

