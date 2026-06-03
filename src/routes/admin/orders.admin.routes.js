"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const AdminOrdersController = require("../../controllers/admin/orders.admin.controller");

const router = express.Router();

router.get(
    "/:orderId/payment",
    requireAuth,
    requireRole(["admin"]),
    asyncHandler(AdminOrdersController.getPaymentAudit)
);

router.post(
    "/:orderId/refund",
    requireAuth,
    requireRole(["admin"]),
    asyncHandler(AdminOrdersController.initiateRefund)
);

module.exports = router;
