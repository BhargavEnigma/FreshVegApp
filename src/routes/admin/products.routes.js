"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const { productImagesUpload } = require("../../middlewares/upload.middleware");
const AdminProductsController = require("../../controllers/admin/products.admin.controller");

const router = express.Router();

router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.create));

// Create product with images in a single multipart/form-data request.
// FormData fields should match createProductSchema (category_id, name, ...)
// Files field: images (up to 10 images)
router.post(
    "/with-images",
    requireAuth,
    requireRole(["admin"]),
    productImagesUpload.array("images", 10),
    asyncHandler(AdminProductsController.createWithImages)
);
router.put("/:productId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.update));
router.patch("/:productId/active", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.setActive));

// Packs
router.post("/:productId/packs", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.createPack));
router.put("/packs/:packId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.updatePack));
router.patch("/packs/:packId/active", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.setPackActive));
router.delete("/packs/:packId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.deletePack));

// Images
router.post("/:productId/images", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.addImage));

// Upload image files and directly create ProductImage rows for the product.
// Files field: images (up to 10 images)
router.post(
    "/:productId/images/upload",
    requireAuth,
    requireRole(["admin"]),
    productImagesUpload.array("images", 10),
    asyncHandler(AdminProductsController.uploadImages)
);
router.put("/images/:imageId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.updateImage));
router.delete("/images/:imageId", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.deleteImage));
router.put("/:productId/images/reorder", requireAuth, requireRole(["admin"]), asyncHandler(AdminProductsController.reorderImages));

module.exports = router;
