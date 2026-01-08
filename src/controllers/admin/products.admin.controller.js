"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");
const AdminProductsService = require("../../services/admin/products.admin.service");

const {
    productIdParamSchema,
    packIdParamSchema,
    createProductSchema,
    updateProductSchema,
    setActiveSchema,
    createPackSchema,
    updatePackSchema,
    setPackActiveSchema,
} = require("../../validations/admin/products.admin.validation");

async function create(req, res) {
    try {
        const body = createProductSchema.parse(req.body);
        const data = await AdminProductsService.createProduct({ payload: body });
        return Response.created(res, 201, data);
    } catch (e) {
        console.log('CREATE PRODUCT ERROR : ', e);
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
        const params = productIdParamSchema.parse(req.params);
        const body = updateProductSchema.parse(req.body);
        const data = await AdminProductsService.updateProduct({ productId: params.productId, payload: body });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('UPDATE PRODUCT ERROR : ', e);
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
        const params = productIdParamSchema.parse(req.params);
        const body = setActiveSchema.parse(req.body);
        const data = await AdminProductsService.setProductActive({ productId: params.productId, is_active: body.is_active });
        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('SET ACTIVE PRODUCT ERROR : ', e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

// Packs
async function createPack(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);
        const body = createPackSchema.parse(req.body);

        const data = await AdminProductsService.createPack({
            productId: params.productId,
            payload: body,
        });

        return Response.created(res, 201, data);
    } catch (e) {
        console.log('CREATE PRODUCT PACK ERROR : ', e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updatePack(req, res) {
    try {
        const params = packIdParamSchema.parse(req.params);
        const body = updatePackSchema.parse(req.body);

        const data = await AdminProductsService.updatePack({
            packId: params.packId,
            payload: body,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('CREATE PRODUCT PACK ERROR : ', e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function setPackActive(req, res) {
    try {
        const params = packIdParamSchema.parse(req.params);
        const body = setPackActiveSchema.parse(req.body);

        const data = await AdminProductsService.setPackActive({
            packId: params.packId,
            is_active: body.is_active,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('CREATE PRODUCT PACK ACTIVE ERROR : ', e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function deletePack(req, res) {
    try {
        const params = packIdParamSchema.parse(req.params);

        const data = await AdminProductsService.deletePack({
            packId: params.packId,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('DELETE PRODUCT PACK ERROR : ', e);

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
    create,
    update,
    setActive,
    createPack,
    updatePack,
    setPackActive,
    deletePack,
};
