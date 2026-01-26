"use strict";

const { z } = require("zod");

const bannerIdParamSchema = z.object({
    bannerId: z.string().uuid(),
});

const actionTypeEnum = z.enum(["none", "product", "category", "collection", "external_url"]);
const placementEnum = z.string().max(50);

const createBannerSchema = z.object({
    title: z.string().max(200).nullable().optional(),
    subtitle: z.string().max(500).nullable().optional(),

    image_url: z.string().url().optional(), // required if not uploading file
    placement: placementEnum.optional().default("home"),
    action_type: actionTypeEnum.optional().default("none"),
    action_value: z.string().max(2000).nullable().optional(),

    // ✅ multer/form-data => string, so coerce
    sort_order: z.coerce.number().int().min(0).optional().default(0),

    // ✅ multer/form-data => string, so coerce
    is_active: z.coerce.boolean().optional().default(true),

    // ✅ allow "" coming from form inputs
    start_at: z
        .preprocess((v) => (v === "" ? null : v), z.string().datetime().nullable().optional()),
    end_at: z
        .preprocess((v) => (v === "" ? null : v), z.string().datetime().nullable().optional()),
});


const updateBannerSchema = z.object({
    title: z.string().max(200).nullable().optional(),
    subtitle: z.string().max(500).nullable().optional(),
    image_url: z.string().url().nullable().optional(),
    placement: placementEnum.optional(),
    action_type: actionTypeEnum.optional(),
    action_value: z.string().max(2000).nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
    start_at: z.string().datetime().nullable().optional(),
    end_at: z.string().datetime().nullable().optional(),
    is_active: z.boolean().optional(),
});

const reorderBannersSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});

module.exports = {
    bannerIdParamSchema,
    createBannerSchema,
    updateBannerSchema,
    reorderBannersSchema,
    actionTypeEnum,
};
