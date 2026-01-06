const express = require("express");
const CheckoutController = require("../../src/controllers/checkout.controller");
const { requireAuth } = require("../../src/middlewares/auth.middleware");

const router = express.Router();

router.post("/", requireAuth, CheckoutController.checkout);

module.exports = router;
