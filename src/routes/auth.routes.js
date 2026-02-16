const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { createRateLimiter } = require("../middlewares/rateLimit.middleware");

const router = express.Router();

const otpSendLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    messageCode: "OTP_SEND_RATE_LIMITED",
});

const otpVerifyLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    messageCode: "OTP_VERIFY_RATE_LIMITED",
});

const refreshLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    messageCode: "REFRESH_RATE_LIMITED",
});

router.post("/otp/send", otpSendLimiter, AuthController.sendOtp);
router.post("/otp/verify", otpVerifyLimiter, AuthController.verifyOtp);

router.post("/token/refresh", refreshLimiter, AuthController.refreshToken);

router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);

module.exports = router;
