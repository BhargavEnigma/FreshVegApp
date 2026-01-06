"use strict";

const { z } = require("zod");

const phoneSchema = z
    .string()
    .trim()
    .refine((v) => /^\d{10}$/.test(v) || /^91\d{10}$/.test(v), {
        message: "Phone must be 10 digits or 91 + 10 digits",
    });

const sendOtpSchema = z.object({
    phone: phoneSchema,
    purpose: z.literal("login"),
});

const verifyOtpSchema = z.object({
    otp_request_id: z.string().uuid(),
    phone: phoneSchema,
    otp: z.string().min(4).max(8),
    device: z
        .object({
            device_id: z.string().optional().nullable(),
            device_name: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    fcm_token: z.string().min(10).max(500).optional().nullable(),
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
