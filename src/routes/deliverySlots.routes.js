"use strict";

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const DeliverySlotsController = require("../controllers/deliverySlots.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

// Public OR requireAuth (your choice). Blueprint usually allows public.
router.get("/", requireAuth, asyncHandler(DeliverySlotsController.list));

module.exports = router;
