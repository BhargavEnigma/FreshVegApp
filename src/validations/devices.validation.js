"use strict";

const { z } = require("zod");

const platformEnum = z.enum(["android", "ios", "web"]).optional().nullable();

const registerDeviceSchema = z.object({
    // Client should send a stable device id per install (e.g., uuid v4 stored in secure storage).
    device_id: z.string().min(3).max(120).optional().nullable(),

    // FCM token for this device
    fcm_token: z.string().min(10).max(500),

    platform: platformEnum,
});

const unregisterDeviceSchema = z.object({
    // Prefer device_id (logout), but allow passing token.
    device_id: z.string().min(3).max(120).optional().nullable(),
    fcm_token: z.string().min(10).max(500).optional().nullable(),
});

module.exports = {
    registerDeviceSchema,
    unregisterDeviceSchema,
};
