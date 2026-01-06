const CartService = require("../services/cart.service");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

const {
    addCartItemSchema,
    updateCartItemSchema,
    cartItemIdParamSchema,
} = require("../validations/cart.schema");

async function getMyCart(req, res) {
    try {
        const data = await CartService.getMyCart({
            userId: req.user.userId,
        });

        return Response.ok(res, data);
    } catch (e) {
        console.error("GET CART ERROR:", {
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
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function addItem(req, res) {
    try {
        const body = addCartItemSchema.parse(req.body);
        console.log('PAYLOD : ', body);

        const data = await CartService.addItem({
            userId: req.user.userId,
            payload: body,
        });

        return Response.created(res, data, "Item added in Cart");
    } catch (e) {
        console.log('ERROR : ', e);

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updateItem(req, res) {
    try {
        const params = cartItemIdParamSchema.parse(req.params);
        const body = updateCartItemSchema.parse(req.body);

        const data = await CartService.updateItem({
            userId: req.user.userId,
            itemId: params.itemId,
            payload: body,
        });

        return Response.ok(res, data);
    } catch (e) {
        console.error("UPDATE CART ITEM ERROR:", {
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

async function removeItem(req, res) {
    try {
        const params = cartItemIdParamSchema.parse(req.params);

        const data = await CartService.removeItem({
            userId: req.user.userId,
            itemId: params.itemId,
        });

        return Response.ok(res, data);
    } catch (e) {
        console.error("REMOVE CART ITEM ERROR:", {
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

async function clear(req, res) {
    try {
        const data = await CartService.clear({
            userId: req.user.userId,
        });

        return Response.ok(res, data);
    } catch (e) {
        console.error("CLEAR CART ERROR:", {
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
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    getMyCart,
    addItem,
    updateItem,
    removeItem,
    clear,
};
