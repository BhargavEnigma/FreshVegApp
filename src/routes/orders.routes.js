"use strict";

const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const OrdersController = require("../controllers/orders.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(OrdersController.listMyOrders));
router.get("/:orderId", requireAuth, asyncHandler(OrdersController.getMyOrderById));
router.post("/:id/cancel", requireAuth, asyncHandler(OrdersController.cancelMyOrder));

module.exports = router;
