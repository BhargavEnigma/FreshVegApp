"use strict";

const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

const BannersService = require("../services/banners.service");
const { listBannersQuerySchema } = require("../validations/banners.validation");

async function list(req, res) {
    try {
        const query = listBannersQuerySchema.parse(req.query);

        const data = await BannersService.listActive({
            placement: query.placement,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("BANNERS LIST ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = { list };
