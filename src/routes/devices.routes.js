"use strict";

const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const DevicesController = require("../controllers/devices.controller");

const router = express.Router();

// Customer app: register/update token
router.post("/fcm-token", requireAuth, asyncHandler(DevicesController.register));

// Logout / disable a token
router.post("/fcm-token/remove", requireAuth, asyncHandler(DevicesController.unregister));

// Debug endpoint (helpful during integration)
router.get("/me", requireAuth, asyncHandler(DevicesController.listMy));

module.exports = router;
