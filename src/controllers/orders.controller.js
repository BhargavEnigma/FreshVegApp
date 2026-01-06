"use strict";

const OrdersService = require("../services/orders.service");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

const {
    orderIdParamSchema,
    listOrdersQuerySchema,
    cancelOrderSchema,
} = require("../validations/orders.validation");

async function listMyOrders(req, res) {
    try {
        const query = listOrdersQuerySchema.parse(req.query);

        const data = await OrdersService.listMyOrders({
            userId: req.user.userId,
            query,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("LIST MY ORDERS ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function getMyOrderById(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);

        const data = await OrdersService.getMyOrderById({
            userId: req.user.userId,
            orderId: params.orderId,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("GET MY ORDER ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function cancelMyOrder(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);
        const body = cancelOrderSchema.parse(req.body);

        const data = await OrdersService.cancelMyOrder({
            userId: req.user.userId,
            orderId: params.orderId,
            reason: body.reason ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("CANCEL ORDER ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    listMyOrders,
    getMyOrderById,
    cancelMyOrder,
};
