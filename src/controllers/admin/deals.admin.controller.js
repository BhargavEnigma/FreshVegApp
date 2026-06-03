"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");

const DealsAdminService = require("../../services/admin/deals.admin.service");

const {
    dealIdParamSchema,
    dealItemIdParamSchema,
    createDealSchema,
    updateDealSchema,
    listDealsQuerySchema,
    packSearchQuerySchema,
    upsertDealItemsSchema,
} = require("../../validations/admin/deals.admin.validation");

async function list(req, res) {
    try {
        const query = listDealsQuerySchema.parse(req.query);
        const data = await DealsAdminService.list({
            from: query.from,
            to: query.to,
            active: query.active,
        });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS LIST ERROR:", e);

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
        const params = dealIdParamSchema.parse(req.params);
        const data = await DealsAdminService.getById({ dealId: params.dealId });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS GET ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function create(req, res) {
    try {
        const body = createDealSchema.parse(req.body);
        const data = await DealsAdminService.create({ payload: body });
        return Response.created(res, 201, data);
    } catch (e) {
        console.log("ADMIN DEALS CREATE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function update(req, res) {
    try {
        const params = dealIdParamSchema.parse(req.params);
        const body = updateDealSchema.parse(req.body);

        const data = await DealsAdminService.update({ dealId: params.dealId, payload: body });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS UPDATE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function remove(req, res) {
    try {
        const params = dealIdParamSchema.parse(req.params);
        const data = await DealsAdminService.remove({ dealId: params.dealId });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS DELETE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function packSearch(req, res) {
    try {
        const query = packSearchQuerySchema.parse(req.query);
        const data = await DealsAdminService.packSearch({ q: query.q || null, limit: query.limit });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS PACK SEARCH ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function upsertItems(req, res) {
    try {
        const params = dealIdParamSchema.parse(req.params);
        const body = upsertDealItemsSchema.parse(req.body);

        const data = await DealsAdminService.upsertItems({ dealId: params.dealId, items: body.items });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS UPSERT ITEMS ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function removeItem(req, res) {
    try {
        const params = dealItemIdParamSchema.parse(req.params);
        const data = await DealsAdminService.removeItem({ dealId: params.dealId, itemId: params.itemId });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN DEALS REMOVE ITEM ERROR:", e);

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
    create,
    update,
    remove,
    packSearch,
    upsertItems,
    removeItem,
};
