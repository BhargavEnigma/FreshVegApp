"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const SchedulerOpsController = require("../../controllers/ops/scheduler.ops.controller");

router.use(requireAuth);
router.use(requireRole(["admin"])); // only admin

router.get("/lock-orders", asyncHandler(SchedulerOpsController.getLockOrdersSchedule));
router.get("/lock-orders/presets", asyncHandler(SchedulerOpsController.getLockOrdersSchedulePresets));
router.put("/lock-orders", asyncHandler(SchedulerOpsController.updateLockOrdersSchedule));

module.exports = router;