const express = require("express");
const CartController = require("../controllers/cart.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, CartController.getMyCart);

router.post("/items", requireAuth, CartController.addItem);
router.patch("/items/:itemId", requireAuth, CartController.updateItem);
router.delete("/items/:itemId", requireAuth, CartController.removeItem);

// optional
router.delete("/clear", requireAuth, CartController.clear);

module.exports = router;