"use strict";

const express = require("express");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { asyncHandler } = require("../../utils/asyncHandler");
const OpsOrdersController = require("../../controllers/ops/orders.ops.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.list));
router.get("/export", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.exportCsv));

router.get("/delivery-partners", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.listDeliveryPartners));

router.post("/bulk/assign-delivery-partner", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.bulkAssignDeliveryPartner));
router.post("/bulk/unassign-delivery-partner", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.bulkUnassignDeliveryPartner));
router.post("/bulk/status", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.bulkUpdateStatus));

router.get("/:orderId", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.getById));
router.post("/:orderId/assign-delivery-partner", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.assignDeliveryPartner));
router.post("/:orderId/unassign-delivery-partner", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.unassignDeliveryPartner));

router.patch("/:orderId/status", requireAuth, requireRole(["admin", "warehouse_manager"]), asyncHandler(OpsOrdersController.updateStatus));

module.exports = router;
