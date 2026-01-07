"use strict";

const OpsOrdersService = require("../../services/ops/orders.ops.service");
const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");

const {
    orderIdParamSchema,
    opsListOrdersQuerySchema,
    updateOrderStatusSchema,
} = require("../../validations/ops/orders.ops.validation");

async function list(req, res) {
    try {
        const query = opsListOrdersQuerySchema.parse(req.query);

        const data = await OpsOrdersService.list({
            actorUserId: req.user.userId,
            query,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS LIST ORDERS ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updateStatus(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);
        const body = updateOrderStatusSchema.parse(req.body);

        const data = await OpsOrdersService.updateStatus({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            to_status: body.to_status,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS UPDATE STATUS ERROR:", e?.message, e?.stack);
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
    list,
    updateStatus,
};
