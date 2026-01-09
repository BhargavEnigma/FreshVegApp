"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/requireRole");
const AdminUsersController = require("../../controllers/admin/users.admin.controller");

const router = express.Router();

// Only admin can manage users/roles
router.get("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminUsersController.list));
router.get("/:id", requireAuth, requireRole(["admin"]), asyncHandler(AdminUsersController.getById));
router.post("/", requireAuth, requireRole(["admin"]), asyncHandler(AdminUsersController.create));
router.put("/:id/roles", requireAuth, requireRole(["admin"]), asyncHandler(AdminUsersController.setRoles));

module.exports = router;
