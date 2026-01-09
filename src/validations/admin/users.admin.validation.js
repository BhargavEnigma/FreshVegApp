"use strict";

const { z } = require("zod");

const createAdminUserSchema = z.object({
    phone: z.string().min(12).max(12),
    full_name: z.string().min(2).max(120).optional().nullable(),
    email: z.string().email().optional().nullable(),
    roles: z.array(z.string().min(2).max(40)).min(1),
});

const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    q: z.string().min(1).max(50).optional(),
    role: z.string().min(2).max(40).optional(),
    status: z.enum(["active", "blocked"]).optional(),
    sort_by: z.enum(["created_at", "last_login_at", "phone"]).optional().default("created_at"),
    sort_dir: z.enum(["asc", "desc"]).optional().default("desc"),
}).strict();

const setRolesSchema = z.object({
    roles: z.array(z.string().min(2).max(40)).min(1),
});

module.exports = {
    createAdminUserSchema,
    setRolesSchema,
    listUsersQuerySchema
};
