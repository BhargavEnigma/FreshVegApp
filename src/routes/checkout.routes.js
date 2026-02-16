const express = require("express");
const CheckoutController = require("../controllers/checkout.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", requireAuth, CheckoutController.checkout);

module.exports = router;
