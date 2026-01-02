const rateLimit = require("express-rate-limit");

function createRateLimiter({ windowMs, max, messageCode }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            return res.status(429).json({
                success: false,
                data: null,
                error: {
                    code: messageCode || "RATE_LIMITED",
                    message: "Too many requests. Please try again later.",
                    details: null
                },
                message: null
            });
        }
    });
}

module.exports = { createRateLimiter };
