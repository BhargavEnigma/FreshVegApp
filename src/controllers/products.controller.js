const ProductsService = require("../services/products.service");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

const {
    listProductsQuerySchema,
    productIdParamSchema,
} = require("../validations/products.schema");

async function list(req, res) {
    try {
        const query = listProductsQuerySchema.parse(req.query);

        const data = await ProductsService.list({ query });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("LIST PRODUCTS ERROR:", {
            name: e?.name,
            code: e?.code,
            message: e?.message,
            httpStatus: e?.httpStatus,
            issues: e?.issues,
            stack: e?.stack,
        });

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function getById(req, res) {
    try {
        const params = productIdParamSchema.parse(req.params);

        const data = await ProductsService.getById({
            productId: params.productId,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        console.error("GET PRODUCT ERROR:", {
            name: e?.name,
            code: e?.code,
            message: e?.message,
            httpStatus: e?.httpStatus,
            issues: e?.issues,
            stack: e?.stack,
        });

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
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
};
