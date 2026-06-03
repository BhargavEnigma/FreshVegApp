// src/validations/ops/orders.ops.validation.js
"use strict";

const { z } = require("zod");

const orderIdParamSchema = z.object({
    orderId: z.string().uuid(),
});

const opsListOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),

    status: z.string().optional().nullable(),
    warehouse_id: z.string().uuid().optional().nullable(),
    delivery_partner_user_id: z
        .union([z.string().uuid(), z.literal(["assigned", "unassigned"])])
        .optional()
        .nullable(),
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

const opsDeliveryPartnersQuerySchema = z.object({
    warehouse_id: z.string().uuid().optional().nullable(),
    q: z.string().max(80).optional().nullable(),
}).strict();

const assignDeliveryPartnerSchema = z.object({
    delivery_partner_user_id: z.string().uuid(),
    note: z.string().max(250).optional().nullable(),
}).strict();

const unassignDeliveryPartnerSchema = z.object({
    order_id: z.array(z.string().uuid()).min(1, "Select at least one order"),
    note: z.string().max(250).optional().nullable(),
}).strict();

const bulkAssignDeliveryPartnerSchema = z.object({
    order_ids: z.array(z.string().uuid()).min(1, "Select at least one order"),
    delivery_partner_user_id: z.string().uuid(),
    note: z.string().trim().max(500).optional().nullable(),
}).strict();

const bulkUnassignDeliveryPartnerSchema = z.object({
    order_ids: z.array(z.string().uuid()).min(1, "Select at least one order"),
    delivery_partner_user_id: z.string().uuid(),
    note: z.string().trim().max(500).optional().nullable(),
}).strict();

const bulkUpdateOrderStatusSchema = z.object({
    order_ids: z.array(z.string().uuid()).min(1, "Select at least one order"),
    to_status: z.enum([
        "payment_pending",
        "placed",
        "confirmed",
        "locked",
        "accepted",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
    ]),
    note: z.string().trim().max(500).optional().nullable(),
});

module.exports = {
    orderIdParamSchema,
    opsListOrdersQuerySchema,
    opsDeliveryTodayListOrdersQuerySchema,
    updateOrderStatusSchema,
    opsDeliveryPartnersQuerySchema,
    assignDeliveryPartnerSchema,
    unassignDeliveryPartnerSchema,
    bulkAssignDeliveryPartnerSchema,
    bulkUnassignDeliveryPartnerSchema,
    bulkUpdateOrderStatusSchema,
};
