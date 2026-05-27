"use strict";

const express = require("express");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const DeliveryOrdersController = require("../../controllers/delivery/orders.delivery.controller");

const router = express.Router();

router.get("/assigned", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.listAssigned));
router.get("/today", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.listToday));
router.get("/history", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.listHistory));
router.get("/:orderId", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.getById));

router.post("/:orderId/accept", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.acceptAssigned));
router.post("/:orderId/pick", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.pickAssigned));
router.post("/:orderId/start", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.startDelivery));
router.post("/:orderId/deliver", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.markDelivered));
router.post("/:orderId/fail", requireAuth, requireRole(["delivery_partner", "admin"]), asyncHandler(DeliveryOrdersController.markFailed));

module.exports = router;