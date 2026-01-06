"use strict";

const express = require("express");
const router = express.Router();

const WarehouseController = require("../../controllers/warehouses.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");

// Admin-only (and optional warehouse_manager if you want)
router.use(requireAuth);
router.use(requireRole(["admin"]));
// If you also want warehouse_manager to access list/get: use ["admin", "warehouse_manager"]

router.post("/", WarehouseController.create);
router.get("/", WarehouseController.list);
router.get("/:id", WarehouseController.getById);
router.patch("/:id", WarehouseController.update);
router.delete("/:id", WarehouseController.deactivate);

module.exports = router;
