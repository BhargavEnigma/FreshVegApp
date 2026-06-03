"use strict";

const { z } = require("zod");

const costCategoryEnum = z.enum(["procurement", "delivery", "packaging", "misc"]);

const listCostsQuerySchema = z.object({
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    category: costCategoryEnum.optional(),
    warehouse_id: z.string().uuid().optional(),
    status: z.enum(["active", "archived"]).optional(),
});

const createCostSchema = z.object({
    cost_date: z.string(),
    category: costCategoryEnum,
    warehouse_id: z.string().uuid().optional().nullable(),
    related_order_id: z.string().uuid().optional().nullable(),
    reference_type: z.string().max(80).optional().nullable(),
    reference_no: z.string().max(120).optional().nullable(),
    amount_paise: z.number().int().min(0),
    notes: z.string().max(1000).optional().nullable(),
});

const updateCostSchema = createCostSchema.partial().extend({
    status: z.enum(["active", "archived"]).optional(),
});

const procurementItemsQuerySchema = z.object({
    delivery_date: z.string(),
    warehouse_id: z.string().uuid().optional(),
});

const bulkUpsertProcurementSchema = z.object({
    delivery_date: z.string(),
    warehouse_id: z.string().uuid().optional().nullable(),
    items: z.array(
        z.object({
            product_id: z.string().uuid(),
            product_pack_id: z.string().uuid().optional().nullable(),
            product_name: z.string(),
            pack_label: z.string().optional().nullable(),
            ordered_quantity: z.number().positive(),
            unit_cost_paise: z.number().int().min(0),
            notes: z.string().optional().nullable(),
        })
    ),
});

module.exports = {
    listCostsQuerySchema,
    createCostSchema,
    updateCostSchema,
    procurementItemsQuerySchema,
    bulkUpsertProcurementSchema,
};