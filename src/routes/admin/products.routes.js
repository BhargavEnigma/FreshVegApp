"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const AdminProductsController = require("../../controllers/admin/products.admin.controller");

const router = express.Router();

router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.create));
router.put("/:productId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.update));
router.patch("/:productId/active", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.setActive));

// Packs
router.post("/:productId/packs", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.createPack));
router.put("/packs/:packId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.updatePack));
router.patch("/packs/:packId/active", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.setPackActive));
router.delete("/packs/:packId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.deletePack));

module.exports = router;
