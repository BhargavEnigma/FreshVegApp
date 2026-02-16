"use strict";

const ResponseUtil = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const DevicesService = require("../services/devices.service");
const {
    registerDeviceSchema,
    unregisterDeviceSchema,
} = require("../validations/devices.validation");

async function register(req, res) {
    try {
        const body = registerDeviceSchema.parse(req.body || {});

        const data = await DevicesService.registerDevice({
            userId: req.user.userId,
            device_id: body.device_id || null,
            platform: body.platform || null,
            fcm_token: body.fcm_token,
        });

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        console.error("DEVICE REGISTER ERROR:", e);

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function unregister(req, res) {
    try {
        const body = unregisterDeviceSchema.parse(req.body || {});

        const data = await DevicesService.unregisterDevice({
            userId: req.user.userId,
            device_id: body.device_id || null,
            fcm_token: body.fcm_token || null,
        });

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        console.error("DEVICE UNREGISTER ERROR:", e);

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function listMy(req, res) {
    try {
        const data = await DevicesService.listMyDevices({ userId: req.user.userId });
        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        console.error("DEVICE LIST ERROR:", e);

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    register,
    unregister,
    listMy,
};
