const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middlewares/auth.middleware");
const UserController = require("../controllers/user.controller");

const router = express.Router();

router.get("/me", requireAuth, asyncHandler(UserController.me));

module.exports = router;
