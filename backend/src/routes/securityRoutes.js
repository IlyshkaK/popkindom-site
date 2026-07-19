const express = require("express");
const securityController = require("../controllers/securityController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authRequired, securityController.getSecurity);
router.post("/", authRequired, securityController.legacySecurityPost);
router.post("/auto-login", authRequired, securityController.toggleAutoLogin);
router.post("/password", authRequired, securityController.changePassword);

module.exports = router;
