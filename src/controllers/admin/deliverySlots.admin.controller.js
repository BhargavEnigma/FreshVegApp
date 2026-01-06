"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");
const DeliverySlotsAdminService = require("../../services/admin/deliverySlots.admin.service");

const {
    slotIdParamSchema,
    createDeliverySlotSchema,
    updateDeliverySlotSchema,
    setActiveSchema,
} = require("../../validations/admin/deliverySlots.admin.validation");

async function list(req, res) {
    try {
        const data = await DeliverySlotsAdminService.list();
        return Response.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function create(req, res) {
    try {
        const body = createDeliverySlotSchema.parse(req.body);

        const data = await DeliverySlotsAdminService.create({
            payload: body,
        });

        return Response.created(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function update(req, res) {
    try {
        const params = slotIdParamSchema.parse(req.params);
        const body = updateDeliverySlotSchema.parse(req.body);

        const data = await DeliverySlotsAdminService.update({
            slotId: params.id,
            payload: body,
        });

        return Response.ok(res, data);
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

async function setActive(req, res) {
    try {
        const params = slotIdParamSchema.parse(req.params);
        const body = setActiveSchema.parse(req.body);

        const data = await DeliverySlotsAdminService.setActive({
            slotId: params.id,
            is_active: body.is_active,
        });

        return Response.ok(res, data);
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
    list,
    create,
    update,
    setActive,
};
