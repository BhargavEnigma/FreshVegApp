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

    // allow "" => null (common in forms)
    slug: z.preprocess((v) => (v === "" ? null : v), z.string().min(2).max(80).optional().nullable()),

    // optional manual url (if admin wants), but file upload will override it
    image_url: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).optional().nullable()),

    // multipart => string => coerce
    is_active: z.coerce.boolean().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).max(100000).optional().nullable(),
});

const updateCategorySchema = z.object({
    name: z.preprocess((v) => (v === "" ? null : v), z.string().min(2).max(80).optional().nullable()),
    slug: z.preprocess((v) => (v === "" ? null : v), z.string().min(2).max(80).optional().nullable()),
    image_url: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).optional().nullable()),
    is_active: z.coerce.boolean().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).max(100000).optional().nullable(),
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
