"use strict";

const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const SettingsService = require("../services/settings.service");

async function publicSettings(req, res) {
    try {
        const data = await SettingsService.publicSettings();
        return Response.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = {
    publicSettings,
};
