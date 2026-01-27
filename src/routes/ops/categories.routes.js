"use strict";

const express = require("express");
const router = express.Router();

const {requireAuth} = require("../../middlewares/auth.middleware");
const {requireRole} = require("../../middlewares/requireRole");
const CategoriesController = require("../../controllers/categories.controller");
const { categoryImagesUpload } = require("../../middlewares/upload.middleware");

// Warehouse + Admin: view
router.get(
    "/",
    requireAuth,
    requireRole(["warehouse_manager", "admin"]),
    CategoriesController.listOps
);

router.get(
    "/:id",
    requireAuth,
    requireRole(["warehouse_manager", "admin"]),
    CategoriesController.getById
);

// Admin: manage
router.post(
    "/",
    requireAuth,
    requireRole(["admin"]),
    categoryImagesUpload.single("image"),
    CategoriesController.create
);

router.patch(
    "/:id",
    requireAuth,
    requireRole(["admin"]),
    categoryImagesUpload.single("image"),
    CategoriesController.update
);

router.patch(
    "/:id/toggle-active",
    requireAuth,
    requireRole(["admin"]),
    CategoriesController.toggleActive
);

router.put(
    "/reorder",
    requireAuth,
    requireRole(["admin"]),
    CategoriesController.reorder
);

module.exports = router;
