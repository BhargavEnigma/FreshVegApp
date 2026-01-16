"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");
const AdminProductsService = require("../../services/admin/products.admin.service");

const {
    productIdParamSchema,
    packIdParamSchema,
    imageIdParamSchema,
    createProductSchema,
    updateProductSchema,
    setActiveSchema,
    createPackSchema,
    updatePackSchema,
    setPackActiveSchema,
    addProductImageSchema,
    updateProductImageSchema,
    reorderProductImagesSchema,
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

function parseMultipartProductPayload(body) {
    // Multer parses fields as strings. Normalize to match createProductSchema.
    const toNullable = (v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const s = String(v).trim();
        if (s === "" || s.toLowerCase() === "null") return null;
        return s;
    };

    const toBoolNullable = (v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const s = String(v).trim().toLowerCase();
        if (s === "" || s === "null") return null;
        if (s === "true" || s === "1" || s === "yes") return true;
        if (s === "false" || s === "0" || s === "no") return false;
        return v;
    };

    const toInt = (v) => {
        const n = Number.parseInt(String(v), 10);
        return Number.isFinite(n) ? n : v;
    };

    return {
        category_id: toNullable(body.category_id),
        name: body.name,
        description: toNullable(body.description),
        unit: toNullable(body.unit),
        is_out_of_stock: toBoolNullable(body.is_out_of_stock),
        is_active: toBoolNullable(body.is_active),
        selling_price_paise: toInt(body.selling_price_paise),
        mrp_paise: toInt(body.mrp_paise),
        base_quantity: toInt(body.base_quantity),
    };
}

async function createWithImages(req, res) {
    try {
        const normalized = parseMultipartProductPayload(req.body || {});
        const body = createProductSchema.parse(normalized);

        const files = Array.isArray(req.files) ? req.files : [];
        console.log("FILES COUNT:", Array.isArray(req.files) ? req.files.length : 0);
        console.log("FILES :", req.files ? req.files : "IMAGES NOT FOUND");
        const data = await AdminProductsService.createWithImages({ payload: body, files });

        return Response.created(res, 201, data, "Product created with images");
    } catch (e) {
        console.log("CREATE PRODUCT WITH IMAGES ERROR : ", e);
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

async function updateWithImages(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);

        const normalized = parseMultipartProductPayload(req.body || {});
        const body = updateProductSchema.parse(normalized);

        const files = Array.isArray(req.files) ? req.files : [];
        const data = await AdminProductsService.updateWithImages({
            productId: params.productId,
            payload: body,
            files,
        });

        return Response.ok(res, 200, data, "Product updated with images");
    } catch (e) {
        console.log("UPDATE PRODUCT WITH IMAGES ERROR : ", e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
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
        console.log('UPDATE PRODUCT PACK ERROR : ', e);

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

async function listPacks(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);
        const includeInactive = String(req.query.include_inactive || "").toLowerCase() === "true";

        const data = await AdminProductsService.listPacks({
            productId: params.productId,
            includeInactive,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

// Images
async function addImage(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);
        const body = addProductImageSchema.parse(req.body);

        const data = await AdminProductsService.addProductImage({
            productId: params.productId,
            payload: body,
        });

        return Response.created(res, 201, data);
    } catch (e) {
        console.log('ADD PRODUCT IMAGE ERROR : ', e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function uploadImages(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);
        const files = Array.isArray(req.files) ? req.files : [];

        if (!files.length) {
            return Response.fail(res, 400, "NO_FILES", "No image files provided");
        }

        const data = await AdminProductsService.uploadImagesToProduct({ productId: params.productId, files });
        return Response.created(res, 201, data, "Images uploaded");
    } catch (e) {
        console.log("UPLOAD PRODUCT IMAGES ERROR : ", e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updateImage(req, res) {
    try {
        const params = imageIdParamSchema.parse(req.params);
        const body = updateProductImageSchema.parse(req.body);

        const data = await AdminProductsService.updateProductImage({
            imageId: params.imageId,
            payload: body,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('UPDATE PRODUCT IMAGE ERROR : ', e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function deleteImage(req, res) {
    try {
        const params = imageIdParamSchema.parse(req.params);

        const data = await AdminProductsService.deleteProductImage({
            imageId: params.imageId,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('DELETE PRODUCT IMAGE ERROR : ', e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function reorderImages(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);
        const body = reorderProductImagesSchema.parse(req.body);

        const data = await AdminProductsService.reorderProductImages({
            productId: params.productId,
            payload: body,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.log('REORDER PRODUCT IMAGES ERROR : ', e);
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function deleteProduct(req, res) {
    try {
        const { productId } = req.params;

        const data = await AdminProductsService.deleteProduct({ productId });

        return Response.ok(res, data, "Product deleted");
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}


module.exports = {
    create,
    createWithImages,
    update,
    updateWithImages,
    setActive,
    listPacks,
    createPack,
    updatePack,
    setPackActive,
    deletePack,
    deleteProduct,
    // Images
    addImage,
    uploadImages,
    updateImage,
    deleteImage,
    reorderImages,
};
