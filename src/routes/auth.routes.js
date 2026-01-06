const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/otp/send", AuthController.sendOtp);
router.post("/otp/verify", AuthController.verifyOtp);

router.post("/token/refresh", AuthController.refreshToken);

router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);

module.exports = router;
