"use strict";

const { z } = require("zod");

const deliveryOrderIdParamSchema = z.object({
    orderId: z.string().uuid(),
});

const deliveryListAssignedOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    status: z.enum(["packed", "out_for_delivery", "delivered", "delivery_failed"]).optional().nullable(),
    q: z.string().max(80).optional().nullable(),
}).strict();

const deliveryActionNoteSchema = z.object({
    note: z.string().max(250).optional().nullable(),
}).strict();

const deliveryMarkDeliveredSchema = z.object({
    customer_otp: z.string().trim().min(4).max(10).optional().nullable(),
    proof_image_url: z.string().url().max(1000).optional().nullable(),
    recipient_name: z.string().trim().min(2).max(120).optional().nullable(),
    note: z.string().max(250).optional().nullable(),
}).strict();

const deliveryMarkFailedSchema = z.object({
    reason: z.string().trim().min(2).max(250),
    proof_image_url: z.string().url().max(1000).optional().nullable(),
    note: z.string().max(250).optional().nullable(),
}).strict();

module.exports = {
    deliveryOrderIdParamSchema,
    deliveryListAssignedOrdersQuerySchema,
    deliveryActionNoteSchema,
    deliveryMarkDeliveredSchema,
    deliveryMarkFailedSchema,
};