"use strict";

const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const OrdersController = require("../controllers/orders.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(OrdersController.listMyOrders));
router.get("/:orderId", requireAuth, asyncHandler(OrdersController.getMyOrderById));
router.get("/:orderId/payment-status", requireAuth, asyncHandler(OrdersController.getPaymentStatus));
router.post("/:orderId/payments/retry", requireAuth, asyncHandler(OrdersController.retryPayment));
router.post("/:orderId/payments/reconcile", requireAuth, asyncHandler(OrdersController.reconcilePayment));
router.post("/:orderId/cancel", requireAuth, asyncHandler(OrdersController.cancelMyOrder));

module.exports = router;
