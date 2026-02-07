"use strict";

const Response = require("../utils/response.util");
const PaymentsService = require("../services/payments.service");
const { AppError } = require("../utils/errors");
const {
    razorpayCreateOrderSchema,
    razorpayVerifySchema,
} = require("../validations/payments.validation");

async function webhook(req, res) {
    const data = await PaymentsService.handleWebhook({
        headers: req.headers,
        payload: req.body,
        rawBody: req.rawBody || JSON.stringify(req.body || {}),
    });

    return Response.ok(res, 200, data);
}

async function razorpayCreateOrder(req, res) {
    try {
        const body = razorpayCreateOrderSchema.parse(req.body);

        const data = await PaymentsService.razorpayCreateOrder({
            userId: req.user.userId,
            orderId: body.order_id,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        if (e?.name === "ZodError") {
            throw new AppError("VALIDATION_ERROR", "Invalid request body", 400);
        }
        throw e;
    }
}

async function razorpayVerify(req, res) {
    try {
        const body = razorpayVerifySchema.parse(req.body);

        const data = await PaymentsService.razorpayVerifyPayment({
            userId: req.user.userId,
            payload: body,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        if (e?.name === "ZodError") {
            throw new AppError("VALIDATION_ERROR", "Invalid request body", 400);
        }
        throw e;
    }
}

module.exports = {
    webhook,
    razorpayCreateOrder,
    razorpayVerify,
};
