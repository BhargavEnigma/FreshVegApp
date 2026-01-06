"use strict";

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const PaymentsController = require("../controllers/payments.controller");

const router = express.Router();

// Webhook should NOT require auth
router.post("/webhook", asyncHandler(PaymentsController.webhook));

module.exports = router;
