"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const AdminDashboardController = require("../../controllers/admin/dashboard.admin.controller");

const router = express.Router();

// Admin + warehouse_manager dashboard KPIs
router.get(
    "/kpis",
    requireAuth,
    requireRole(["admin", "warehouse_manager"]),
    asyncHandler(AdminDashboardController.getKpis)
);

module.exports = router;
