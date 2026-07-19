const express = require("express");
const accountController = require("../controllers/accountController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authRequired, accountController.getAccount);

module.exports = router;
