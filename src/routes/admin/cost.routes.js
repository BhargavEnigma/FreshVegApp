"use strict";

const express = require("express");
const router = express.Router();

const CostController = require("../../controllers/cost.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");

router.use(requireAuth);
router.use(requireRole(["admin"]));

router.get("/", asyncHandler(CostController.list));
router.get("/summary", asyncHandler(CostController.summary));
router.get("/profit-overview", asyncHandler(CostController.profitOverview));
router.get("/procurement-items", asyncHandler(CostController.procurementItems));

router.post("/", asyncHandler(CostController.create));
router.post("/procurement-costs/bulk", asyncHandler(CostController.bulkUpsertProcurement));

router.get("/:id", asyncHandler(CostController.getById));
router.patch("/:id", asyncHandler(CostController.update));
router.delete("/:id", asyncHandler(CostController.archive));

module.exports = router;