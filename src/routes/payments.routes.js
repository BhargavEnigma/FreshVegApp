"use strict";

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const PaymentsController = require("../controllers/payments.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

// Razorpay (customer)
router.post(
    "/razorpay/create-order",
    requireAuth,
    asyncHandler(PaymentsController.razorpayCreateOrder)
);

router.post(
    "/razorpay/verify",
    requireAuth,
    asyncHandler(PaymentsController.razorpayVerify)
);

// Webhook should NOT require auth
router.post("/webhook", asyncHandler(PaymentsController.webhook));

module.exports = router;
