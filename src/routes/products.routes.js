const express = require("express");
const ProductsController = require("../controllers/products.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", requireAuth, ProductsController.list);
router.get("/:productId", requireAuth, ProductsController.getById);

module.exports = router;
