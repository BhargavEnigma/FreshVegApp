"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const ReportsController = require("../../controllers/ops/reports.ops.controller");

// Warehouse Manager + Admin can view procurement
router.use(requireAuth);
router.use(requireRole(["admin", "warehouse_manager"]));

router.get("/procurement", asyncHandler(ReportsController.procurement));

module.exports = router;
