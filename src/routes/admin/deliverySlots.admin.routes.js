"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const DeliverySlotsAdminController = require("../../controllers/admin/deliverySlots.admin.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), asyncHandler(DeliverySlotsAdminController.list));
router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(DeliverySlotsAdminController.create));
router.put("/:id", requireAuth, requireRole(["admin"]), asyncHandler(DeliverySlotsAdminController.update));
router.patch("/:id/active", requireAuth, requireRole(["admin"]), asyncHandler(DeliverySlotsAdminController.setActive));

module.exports = router;
