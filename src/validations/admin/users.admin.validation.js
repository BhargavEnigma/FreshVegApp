"use strict";

const { z } = require("zod");

const createAdminUserSchema = z.object({
    phone: z.string().min(12).max(12), // 91 + 10 digits
    full_name: z.string().min(2).max(120).optional().nullable(),
    roles: z.array(z.string().min(2).max(40)).min(1),
});

const setRolesSchema = z.object({
    roles: z.array(z.string().min(2).max(40)).min(1),
});

module.exports = {
    createAdminUserSchema,
    setRolesSchema,
};
