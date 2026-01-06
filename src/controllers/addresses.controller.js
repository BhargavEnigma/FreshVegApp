"use strict";

const ResponseUtil = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const AddressesService = require("../services/addresses.service");
const {
    createAddressSchema,
    updateAddressSchema,
    addressIdParamSchema,
} = require("../validations/addresses.validation");

async function list(req, res) {
    try {
        const data = await AddressesService.list({ userId: req.user.userId });
        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("LIST ADDRESSES ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function create(req, res) {
    try {
        const body = createAddressSchema.parse(req.body);

        const data = await AddressesService.create({
            userId: req.user.userId,
            payload: body,
        });

        return ResponseUtil.created(res, data);
    } catch (e) {
        console.log('ERROR ____', e);
        // console.error("CREATE ADDRESS ERROR:", {
        //     name: e?.name,
        //     code: e?.code,
        //     message: e?.message,
        //     httpStatus: e?.httpStatus,
        //     issues: e?.issues,
        //     stack: e?.stack,
        // });

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function update(req, res) {
    try {
        const params = addressIdParamSchema.parse(req.params);
        const body = updateAddressSchema.parse(req.body);

        const data = await AddressesService.update({
            userId: req.user.userId,
            addressId: params.id,
            payload: body,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("UPDATE ADDRESS ERROR:", {
            name: e?.name,
            code: e?.code,
            message: e?.message,
            httpStatus: e?.httpStatus,
            issues: e?.issues,
            stack: e?.stack,
        });

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function remove(req, res) {
    try {
        const params = addressIdParamSchema.parse(req.params);

        const data = await AddressesService.remove({
            userId: req.user.userId,
            addressId: params.id,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("DELETE ADDRESS ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function setDefault(req, res) {
    try {
        const params = addressIdParamSchema.parse(req.params);

        const data = await AddressesService.setDefault({
            userId: req.user.userId,
            addressId: params.id,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("SET DEFAULT ADDRESS ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    list,
    create,
    update,
    remove,
    setDefault,
};
