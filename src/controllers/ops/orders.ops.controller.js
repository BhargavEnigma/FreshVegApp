"use strict";

const OpsOrdersService = require("../../services/ops/orders.ops.service");
const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");

const {
    orderIdParamSchema,
    opsListOrdersQuerySchema,
    updateOrderStatusSchema,
    opsDeliveryPartnersQuerySchema,
    assignDeliveryPartnerSchema,
    unassignDeliveryPartnerSchema,
    bulkAssignDeliveryPartnerSchema,
    bulkUnassignDeliveryPartnerSchema,
    bulkUpdateOrderStatusSchema,
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

async function bulkAssignDeliveryPartner(req, res) {
    try {
        const body = bulkAssignDeliveryPartnerSchema.parse(req.body || {});

        const data = await OpsOrdersService.bulkAssignDeliveryPartner({
            actorUserId: req.user.userId,
            orderIds: body.order_ids,
            deliveryPartnerUserId: body.delivery_partner_user_id,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS BULK ASSIGN DELIVERY PARTNER ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }

        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }

        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function bulkUnassignDeliveryPartner(req, res) {
    try {
        const body = bulkUnassignDeliveryPartnerSchema.parse(req.body || {});

        const data = await OpsOrdersService.bulkUnassignDeliveryPartner({
            actorUserId: req.user.userId,
            orderIds: body.order_ids,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS BULK UNASSIGN DELIVERY PARTNER ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }

        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }

        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function bulkUpdateStatus(req, res) {
    console.log('BULK UPDATE CALL...', req.body);
    try {
        const body = bulkUpdateOrderStatusSchema.parse(req.body || {});

        const data = await OpsOrdersService.bulkUpdateStatus({
            actorUserId: req.user.userId,
            orderIds: body.order_ids,
            to_status: body.to_status,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS BULK UPDATE STATUS ERROR:", e);

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

async function listDeliveryPartners(req, res) {
    try {
        const query = opsDeliveryPartnersQuerySchema.parse(req.query || {});
        const data = await OpsOrdersService.listDeliveryPartners({
            actorUserId: req.user.userId,
            query,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS LIST DELIVERY PARTNERS ERROR:", e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function assignDeliveryPartner(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);
        const body = assignDeliveryPartnerSchema.parse(req.body || {});

        const data = await OpsOrdersService.assignDeliveryPartner({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            deliveryPartnerUserId: body.delivery_partner_user_id,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS ASSIGN DELIVERY PARTNER ERROR:", e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function unassignDeliveryPartner(req, res) {
    try {
        const params = orderIdParamSchema.parse(req.params);
        const body = unassignDeliveryPartnerSchema.parse(req.body || {});

        const data = await OpsOrdersService.unassignDeliveryPartner({
            actorUserId: req.user.userId,
            order_id: body.orderId,
            note: body.note ?? null,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("OPS UNASSIGN DELIVERY PARTNER ERROR:", e);
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
    listDeliveryPartners,
    getById,
    exportCsv,
    updateStatus,
    bulkUpdateStatus,
    assignDeliveryPartner,
    unassignDeliveryPartner,
    bulkAssignDeliveryPartner,
    bulkUnassignDeliveryPartner,
};
