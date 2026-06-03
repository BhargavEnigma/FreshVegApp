"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");
const DeliveryOrdersService = require("../../services/delivery/orders.delivery.service");
const {
    deliveryOrderIdParamSchema,
    deliveryListAssignedOrdersQuerySchema,
    deliveryActionNoteSchema,
    deliveryMarkDeliveredSchema,
    deliveryMarkFailedSchema,
} = require("../../validations/delivery/orders.delivery.validation");

async function listAssigned(req, res) {
    try {
        const query = deliveryListAssignedOrdersQuerySchema.parse(req.query || {});
        const data = await DeliveryOrdersService.listAssignedOrders({
            actorUserId: req.user.userId,
            query,
        });

        console.log('query : ', query);
        
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function listToday(req, res) {
    try {
        const query = deliveryListAssignedOrdersQuerySchema.parse(req.query || {});
        const data = await DeliveryOrdersService.listTodayOrders({
            actorUserId: req.user.userId,
            query,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function listHistory(req, res) {
    try {
        const query = deliveryListAssignedOrdersQuerySchema.parse(req.query || {});
        const data = await DeliveryOrdersService.listHistory({
            actorUserId: req.user.userId,
            query,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function getById(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const data = await DeliveryOrdersService.getAssignedOrderById({
            actorUserId: req.user.userId,
            orderId: params.orderId,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function acceptAssigned(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const body = deliveryActionNoteSchema.parse(req.body || {});
        const data = await DeliveryOrdersService.acceptAssignedOrder({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            note: body.note ?? null,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function pickAssigned(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const body = deliveryActionNoteSchema.parse(req.body || {});
        const data = await DeliveryOrdersService.pickAssignedOrder({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            note: body.note ?? null,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function startDelivery(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const body = deliveryActionNoteSchema.parse(req.body || {});
        const data = await DeliveryOrdersService.startDelivery({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            note: body.note ?? null,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function markDelivered(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const body = deliveryMarkDeliveredSchema.parse(req.body || {});
        const data = await DeliveryOrdersService.markDelivered({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            customerOtp: body.customer_otp ?? null,
            proofImageUrl: body.proof_image_url ?? null,
            recipientName: body.recipient_name ?? null,
            note: body.note ?? null,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function markFailed(req, res) {
    try {
        const params = deliveryOrderIdParamSchema.parse(req.params);
        const body = deliveryMarkFailedSchema.parse(req.body || {});
        const data = await DeliveryOrdersService.markFailed({
            actorUserId: req.user.userId,
            orderId: params.orderId,
            reason: body.reason,
            proofImageUrl: body.proof_image_url ?? null,
            note: body.note ?? null,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
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
    listAssigned,
    listToday,
    listHistory,
    getById,
    acceptAssigned,
    pickAssigned,
    startDelivery,
    markDelivered,
    markFailed,
};