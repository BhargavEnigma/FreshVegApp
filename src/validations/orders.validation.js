"use strict";

const { z } = require("zod");

const orderIdParamSchema = z.object({
    orderId: z.string().uuid(),
});

const listOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    status: z.string().optional().nullable(),
});

const cancelOrderSchema = z.object({
    reason: z.string().max(250).optional().nullable(),
});

module.exports = {
    orderIdParamSchema,
    listOrdersQuerySchema,
    cancelOrderSchema,
};
