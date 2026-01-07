"use strict";

const Response = require("../../utils/response.util");
const { AppError } = require("../../utils/errors");
const SettingsAdminService = require("../../services/admin/settings.admin.service");

const {
    settingKeyParamSchema,
    upsertSettingSchema,
} = require("../../validations/admin/settings.admin.validation");

async function list(req, res) {
    try {
        const data = await SettingsAdminService.list();
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function getByKey(req, res) {
    try {
        const params = settingKeyParamSchema.parse(req.params);

        const data = await SettingsAdminService.getByKey({
            key: params.key,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function upsert(req, res) {
    try {
        const params = settingKeyParamSchema.parse(req.params);
        const body = upsertSettingSchema.parse(req.body);

        const data = await SettingsAdminService.upsert({
            key: params.key,
            value: body.value,
        });

        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    list,
    getByKey,
    upsert,
};
