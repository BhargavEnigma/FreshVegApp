"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");

const { bannerImagesUpload } = require("../../middlewares/upload.middleware");

const AdminBannersController = require("../../controllers/admin/banners.admin.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.list));

// Create banner with image URL (no file upload)
router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.create));

// Create banner with image file upload (multipart/form-data)
// Files field: image (single)
router.post(
    "/with-image",
    requireAuth,
    requireRole(["admin"]),
    bannerImagesUpload.single("image"),
    asyncHandler(AdminBannersController.createWithImage)
);

router.put("/:bannerId", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.update));

// Update banner + optionally replace image in same call (multipart/form-data)
// Files field: image (single)
router.put(
    "/:bannerId/with-image",
    requireAuth,
    requireRole(["admin"]),
    bannerImagesUpload.single("image"),
    asyncHandler(AdminBannersController.updateWithImage)
);

router.patch("/:bannerId/active", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.setActive));

router.put("/reorder", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.reorder));

router.delete("/:bannerId", requireAuth, requireRole(["admin"]), asyncHandler(AdminBannersController.remove));

module.exports = router;
