"use strict";

const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

const DealsService = require("../services/deals.service");
const { getDealsQuerySchema } = require("../validations/deals.validation");

async function getToday(req, res) {
    try {
        const query = getDealsQuerySchema.parse(req.query);

        const data = await DealsService.getToday({ date: query.date || null });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("DEALS GET TODAY ERROR:", e);

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
    getToday,
};
