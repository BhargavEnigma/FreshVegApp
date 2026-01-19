"use strict";

const express = require("express");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const OpsOrdersController = require("../../controllers/ops/orders.ops.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.list));
router.get("/deliveryTodayOrders", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.deliveryTodayOrderList));
router.patch("/:orderId/status", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.updateStatus));

module.exports = router;
