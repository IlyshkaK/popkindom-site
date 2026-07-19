const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/:nickname", userController.getUserByNickname);

module.exports = router;
