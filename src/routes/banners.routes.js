"use strict";

const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");

const BannersController = require("../controllers/banners.controller");

const router = express.Router();
router.get("/", requireAuth, asyncHandler(BannersController.list));

module.exports = router;
