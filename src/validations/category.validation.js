"use strict";

const { z } = require("zod");

const uuidSchema = z.string().uuid();

const listPublicSchema = z.object({
    q: z.string().max(80).optional().nullable(),
}).passthrough();

const listOpsSchema = z.object({
    q: z.string().max(80).optional().nullable(),
    include_inactive: z
        .string()
        .optional()
        .nullable()
        .transform((v) => v === "true"),
}).passthrough();

const createCategorySchema = z.object({
    name: z.string().min(2).max(80),
    slug: z.string().min(2).max(80).optional().nullable(),
    is_active: z.boolean().optional().nullable(),
    sort_order: z.number().int().min(0).max(100000).optional().nullable(),
});

const updateCategorySchema = z.object({
    name: z.string().min(2).max(80).optional().nullable(),
    slug: z.string().min(2).max(80).optional().nullable(),
    is_active: z.boolean().optional().nullable(),
    sort_order: z.number().int().min(0).max(100000).optional().nullable(),
});

const reorderSchema = z.object({
    items: z.array(
        z.object({
            id: uuidSchema,
            sort_order: z.number().int().min(0).max(100000),
        })
    ).min(1).max(200),
});

module.exports = {
    uuidSchema,
    listPublicSchema,
    listOpsSchema,
    createCategorySchema,
    updateCategorySchema,
    reorderSchema,
};
