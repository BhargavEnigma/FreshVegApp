"use strict";

const { z } = require("zod");

const orderIdParamSchema = z.object({
    orderId: z.string().uuid(),
});

const initiateRefundSchema = z.object({
    reason: z.string().max(250).optional().nullable(),
});

module.exports = {
    orderIdParamSchema,
    initiateRefundSchema,
};
