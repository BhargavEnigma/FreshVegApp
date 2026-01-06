"use strict";

const express = require("express");
const router = express.Router();

const {requireAuth} = require("../middlewares/auth.middleware");
const {requireRole} = require("../middlewares/requireRole");
const CategoriesController = require("../controllers/categories.controller");

// Customer + Ops can browse catalog (Blueprint says yes) :contentReference[oaicite:3]{index=3}
router.get(
    "/categories",
    requireAuth,
    requireRole(["customer", "warehouse_manager", "admin"]),
    CategoriesController.listPublic
);

module.exports = router;
