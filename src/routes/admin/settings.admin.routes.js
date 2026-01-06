"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const SettingsAdminController = require("../../controllers/admin/settings.admin.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), asyncHandler(SettingsAdminController.list));
router.get("/:key", requireAuth, requireRole(["admin"]), asyncHandler(SettingsAdminController.getByKey));
router.put("/:key", requireAuth, requireRole(["admin"]), asyncHandler(SettingsAdminController.upsert));

module.exports = router;
