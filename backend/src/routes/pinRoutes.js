const express = require("express");
const router = express.Router();

const pinController = require("../controllers/pinController");
const { authRequired } = require("../middleware/authMiddleware");

router.get("/status", authRequired, pinController.getStatus);
router.post("/set", authRequired, pinController.setPin);
router.post("/verify", authRequired, pinController.verifyPin);
router.post("/disable", authRequired, pinController.disablePin);

module.exports = router;
