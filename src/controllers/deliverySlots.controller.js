"use strict";

const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const DeliverySlotsService = require("../services/deliverySlots.service");
const { listDeliverySlotsQuerySchema } = require("../validations/deliverySlots.validation");

async function list(req, res) {
    try {
        const query = listDeliverySlotsQuerySchema.parse(req.query);

        const data = await DeliverySlotsService.list({
            query,
        });

        return Response.ok(res, data);
    } catch (e) {
        console.error("LIST DELIVERY SLOTS ERROR:", {
            name: e?.name,
            code: e?.code,
            message: e?.message,
            httpStatus: e?.httpStatus,
            issues: e?.issues,
            stack: e?.stack,
        });

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
};
