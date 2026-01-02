const { z } = require("zod");

const sendOtpSchema = z.object({
    phone: z.string().min(12).max(12), // e.g. 9198XXXXXXXX
    purpose: z.literal("login"),
});

const verifyOtpSchema = z.object({
    otp_request_id: z.string().uuid(),
    phone: z.string().min(12).max(12),
    otp: z.string().min(4).max(8),
    device: z.object({
        device_id: z.string().optional().nullable(),
        device_name: z.string().optional().nullable(),
    }).optional().nullable(),
});

const refreshTokenSchema = z.object({
    refresh_token: z.string().min(10),
    device_id: z.string().optional().nullable(),
});

const logoutSchema = z.object({
    refresh_token: z.string().min(10),
});

module.exports = {
    sendOtpSchema,
    verifyOtpSchema,
    refreshTokenSchema,
    logoutSchema,
};
