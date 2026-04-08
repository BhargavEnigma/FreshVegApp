"use strict";

const { z } = require("zod");

const productIdParamSchema = z.object({
    productId: z.string().uuid(),
});

const packIdParamSchema = z.object({
    packId: z.string().uuid(),
});

const imageIdParamSchema = z.object({
    imageId: z.string().uuid(),
});

const createProductSchema = z.object({
    category_id: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150),
    description: z.string().max(2000).nullable().optional(),
    unit: z.string().max(20).nullable().optional(),
    is_out_of_stock: z.coerce.boolean().optional().nullable(),
    is_active: z.coerce.boolean().optional().nullable(),
    selling_price_paise: z.coerce.number().int().positive(),
    mrp_paise: z.coerce.number().int().positive(),
    base_quantity: z.coerce.number().positive(),
    tag: z.string().max(100).nullable().optional(),
});

const updateProductSchema = z.object({
    category_id: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(2000).nullable().optional(),
    unit: z.string().max(20).nullable().optional(),
    is_out_of_stock: z.coerce.boolean().optional().nullable(),
    is_active: z.coerce.boolean().optional().nullable(),
    selling_price_paise: z.coerce.number().int().positive().optional(),
    mrp_paise: z.coerce.number().int().positive().optional(),
    base_quantity: z.coerce.number().positive().optional(),
    tag: z.string().max(100).nullable().optional(),
});

const setActiveSchema = z.object({
    is_active: z.boolean(),
});

// Packs
const createPackSchema = z.object({
    label: z.string().min(1).max(40),               // "250g", "500g"
    base_quantity: z.number().positive(),           // 250
    base_unit: z.string().min(1).max(10),           // "g" | "kg" | "pc"
    mrp_paise: z.number().optional().nullable(),
    selling_price_paise: z.number().optional().nullable(),
    sort_order: z.number().int().min(0).max(999).optional().nullable(),
    is_active: z.boolean().optional().nullable(),
});

const updatePackSchema = z.object({
    label: z.string().min(1).max(40).optional(),
    base_quantity: z.number().positive().optional(),
    base_unit: z.string().min(1).max(10).optional(),
    mrp_paise: z.number().positive().optional().nullable(),
    selling_price_paise: z.number().positive().optional().nullable(),
    sort_order: z.number().int().min(0).max(999).optional().nullable(),
    is_active: z.boolean().optional().nullable(),
});

const setPackActiveSchema = z.object({
    is_active: z.boolean(),
});

// Images
const addProductImageSchema = z.object({
    image_url: z.string().url(),
    sort_order: z.number().int().min(0).max(999).optional().nullable(),
});

const updateProductImageSchema = z.object({
    image_url: z.string().url().optional(),
    sort_order: z.number().int().min(0).max(999).optional().nullable(),
});

const reorderProductImagesSchema = z.object({
    images: z
        .array(
            z.object({
                id: z.string().uuid(),
                sort_order: z.number().int().min(0).max(999),
            })
        )
        .min(1),
});

module.exports = {
    productIdParamSchema,
    packIdParamSchema,
    imageIdParamSchema,
    createProductSchema,
    updateProductSchema,
    setActiveSchema,
    createPackSchema,
    updatePackSchema,
    setPackActiveSchema,
    addProductImageSchema,
    updateProductImageSchema,
    reorderProductImagesSchema,
};
