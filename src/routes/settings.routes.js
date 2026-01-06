"use strict";

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const SettingsController = require("../controllers/settings.controller");

const router = express.Router();

router.get("/public", asyncHandler(SettingsController.publicSettings));

module.exports = router;
