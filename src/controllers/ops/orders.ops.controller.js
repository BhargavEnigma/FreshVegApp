"use strict";

const OpsOrdersService = require("../../services/ops/orders.ops.service");
const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");

const {
    orderIdParamSchema,
    opsListOrdersQuerySchema,
    updateOrderStatusSchema,
    opsDeliveryTodayListOrdersQuerySchema,
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
        console.error("OPS LIST ORDERS ERROR:", e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function exportCsv(req, res) {
    try {
        const query = opsListOrdersQuerySchema.parse(req.query);

        const { csv, filename } = await OpsOrdersService.exportCsv({
            actorUserId: req.user.userId,
            query,
        });

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch (e) {
        console.error("OPS EXPORT CSV ERROR:", e);
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function getById(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);

        const data = await OpsOrdersService.getById({
            actorUserId: req.user.userId,
            orderId: params.orderId,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS GET ORDER ERROR:", e);
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
        console.error("OPS UPDATE STATUS ERROR:", e);
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
    getById,
    exportCsv,
    updateStatus,
};
