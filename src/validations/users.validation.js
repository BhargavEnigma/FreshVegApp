"use strict";

const { z } = require("zod");

const updateProfileSchema = z.object({
    full_name: z.string().min(2).max(100).optional().nullable(),
    email: z.string().email().optional().nullable(),
    fcm_token: z.string().min(10).max(500).optional().nullable(),
});

module.exports = {
    updateProfileSchema,
};
