const express = require("express");
const router = express.Router();

const {
    generateProductDescription,
} = require("../../controllers/admin/ai.admin.controller");

const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");

router.post(
    "/product-description",
    requireAuth,
    requireRole(["admin", "warehouse_manager"]),
    generateProductDescription
);

module.exports = router;