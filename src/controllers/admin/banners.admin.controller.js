"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");

const BannersAdminService = require("../../services/admin/banners.admin.service");

const {
    bannerIdParamSchema,
    createBannerSchema,
    updateBannerSchema,
    reorderBannersSchema,
} = require("../../validations/admin/banners.admin.validation");

async function list(req, res) {
    try {
        const placement = req.query?.placement ? String(req.query.placement) : undefined;

        const data = await BannersAdminService.list({ placement });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS LIST ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function create(req, res) {
    try {
        const body = createBannerSchema.parse(req.body);

        const data = await BannersAdminService.create({ payload: body });
        return Response.created(res, 201, data);
    } catch (e) {
        console.log("ADMIN BANNERS CREATE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function createWithImage(req, res) {
    try {
        
        console.log('body : ', req.body);
        const body = createBannerSchema.parse(req.body);
        const file = req.file;

        if (!file && !body.image_url) {
            return Response.fail(res, 400, "VALIDATION_ERROR", "image_url is required when no image file is uploaded");
        }

        const data = await BannersAdminService.createWithImage({ payload: body, file });
        return Response.created(res, 201, data);

    } catch (e) {
        console.log("ADMIN BANNERS CREATE WITH IMAGE ERROR:", e);

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
        const params = bannerIdParamSchema.parse(req.params);
        const body = updateBannerSchema.parse(req.body);

        const data = await BannersAdminService.update({
            bannerId: params.bannerId,
            payload: body,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS UPDATE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updateWithImage(req, res) {
    try {
        const params = bannerIdParamSchema.parse(req.params);
        const body = updateBannerSchema.parse(req.body);
        const file = req.file;

        const data = await BannersAdminService.updateWithImage({
            bannerId: params.bannerId,
            payload: body,
            file,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS UPDATE WITH IMAGE ERROR:", e);

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
        const params = bannerIdParamSchema.parse(req.params);

        const is_active = Boolean(req.body?.is_active);

        const data = await BannersAdminService.setActive({
            bannerId: params.bannerId,
            is_active,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS SET ACTIVE ERROR:", e);

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
        const params = bannerIdParamSchema.parse(req.params);

        const data = await BannersAdminService.remove({ bannerId: params.bannerId });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS DELETE ERROR:", e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function reorder(req, res) {
    try {
        const body = reorderBannersSchema.parse(req.body);

        const data = await BannersAdminService.reorder({ ids: body.ids });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log("ADMIN BANNERS REORDER ERROR:", e);

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
    createWithImage,
    update,
    updateWithImage,
    setActive,
    remove,
    reorder,
};
