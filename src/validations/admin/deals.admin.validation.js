"use strict";

const { z } = require("zod");

const dealIdParamSchema = z.object({
    dealId: z.string().uuid(),
});

const dealItemIdParamSchema = z.object({
    dealId: z.string().uuid(),
    itemId: z.string().uuid(),
});

const pricingTypeEnum = z.enum(["fixed_price", "percent_off", "amount_off"]);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const queryBool = z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return v; // let zod throw
}, z.boolean());

const isoDateTimeWithOffset = z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().datetime({ offset: true }).nullable().optional()
);

const createDealSchema = z.object({
    name: z.string().max(200).optional().default("Deals of the Day"),
    description: z.string().max(2000).nullable().optional(),
    deal_date: dateOnly,

    // ISO datetime strings (optional)
    starts_at: isoDateTimeWithOffset,
    ends_at: isoDateTimeWithOffset,

    is_active: z.coerce.boolean().optional().default(true),
    priority: z.coerce.number().int().min(0).optional().default(0),
});

const updateDealSchema = z.object({
    name: z.string().max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    deal_date: dateOnly.optional(),
    starts_at: isoDateTimeWithOffset,
    ends_at: isoDateTimeWithOffset,
    is_active: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
});

const listDealsQuerySchema = z.object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    active: queryBool.optional(),
});

const packSearchQuerySchema = z.object({
    q: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const upsertDealItemsSchema = z.object({
    items: z
        .array(
            z.object({
                // For updates, pass id. For create, omit it.
                id: z.string().uuid().optional(),
                product_pack_id: z.string().uuid(),
                pricing_type: pricingTypeEnum,

                // money in paise
                deal_price_paise: z.coerce.number().int().min(0).nullable().optional(),
                discount_bps: z.coerce.number().int().min(0).max(10000).nullable().optional(),
                discount_paise: z.coerce.number().int().min(0).nullable().optional(),

                max_qty_per_order: z.coerce.number().int().min(1).nullable().optional(),
                sort_order: z.coerce.number().int().min(0).optional().default(0),
                is_active: z.coerce.boolean().optional().default(true),
            })
        )
        .min(1),
});

module.exports = {
    dealIdParamSchema,
    dealItemIdParamSchema,
    pricingTypeEnum,
    createDealSchema,
    updateDealSchema,
    listDealsQuerySchema,
    packSearchQuerySchema,
    upsertDealItemsSchema,
};
