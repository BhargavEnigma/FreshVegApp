"use strict";

const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");

const DealsController = require("../controllers/deals.controller");

const router = express.Router();

// Deals of the Day
router.get("/today", requireAuth, asyncHandler(DealsController.getToday));

module.exports = router;
