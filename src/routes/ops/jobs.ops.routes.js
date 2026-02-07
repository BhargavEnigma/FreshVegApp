"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const JobsController = require("../../controllers/ops/jobs.ops.controller");
const JobRunsController = require("../../controllers/ops/jobRuns.ops.controller");

router.use(requireAuth);
router.use(requireRole(["admin"])); // only admin triggers job manually

router.post("/lock-orders", asyncHandler(JobsController.lockOrders));

// Job execution history
router.get("/runs", asyncHandler(JobRunsController.listJobRuns));

module.exports = router;
