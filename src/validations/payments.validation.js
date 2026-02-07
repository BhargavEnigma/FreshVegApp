"use strict";

const { z } = require("zod");

const uuid = z.string().uuid();

const razorpayCreateOrderSchema = z.object({
    order_id: uuid,
});

// Client sends Razorpay checkout success params
const razorpayVerifySchema = z.object({
    order_id: uuid,
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
});

module.exports = {
    razorpayCreateOrderSchema,
    razorpayVerifySchema,
};
