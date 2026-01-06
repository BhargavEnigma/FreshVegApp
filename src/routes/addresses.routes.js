const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middlewares/auth.middleware");
const AddressesController = require("../controllers/addresses.controller");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(AddressesController.list));
router.post("/", requireAuth, asyncHandler(AddressesController.create));
router.put("/:id", requireAuth, asyncHandler(AddressesController.update));
router.delete("/:id", requireAuth, asyncHandler(AddressesController.remove));
router.patch("/:id/default", requireAuth, asyncHandler(AddressesController.setDefault));

module.exports = router;
