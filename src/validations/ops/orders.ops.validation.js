// src/validations/ops/orders.ops.validation.js
"use strict";

const { z } = require("zod");

const orderIdParamSchema = z.object({
    orderId: z.string().uuid(),
});

const opsListOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),

    status: z.string().optional().nullable(),
    warehouse_id: z.string().uuid().optional().nullable(),
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    q: z.string().max(80).optional().nullable(),
});

const opsDeliveryTodayListOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    warehouse_id: z.string().uuid().optional().nullable(),
    q: z.string().max(80).optional().nullable(),
});

const updateOrderStatusSchema = z.object({
    to_status: z.enum([
        "payment_pending",
        "placed",
        "locked",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",

        // backward compatible (your DB constraint allows them)
        "confirmed",
        "accepted",
    ]),
    note: z.string().max(250).optional().nullable(),
});

module.exports = {
    orderIdParamSchema,
    opsListOrdersQuerySchema,
    opsDeliveryTodayListOrdersQuerySchema,
    updateOrderStatusSchema,
};
