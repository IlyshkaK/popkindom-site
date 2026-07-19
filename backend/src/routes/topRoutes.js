const express = require("express");
const router = express.Router();

const topController = require("../controllers/topController");

router.get("/", topController.getTop);

module.exports = router;
