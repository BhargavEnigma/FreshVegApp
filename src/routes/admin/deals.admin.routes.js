"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");

const AdminDealsController = require("../../controllers/admin/deals.admin.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.list));
router.get("/packs", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.packSearch));
router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.create));
router.get("/:dealId", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.getById));
router.put("/:dealId", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.update));
router.delete("/:dealId", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.remove));

// Items management
router.put("/:dealId/items", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.upsertItems));
router.delete("/:dealId/items/:itemId", requireAuth, requireRole(["admin"]), asyncHandler(AdminDealsController.removeItem));

module.exports = router;
