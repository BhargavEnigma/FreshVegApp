"use strict";

const ResponseUtil = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const { updateProfileSchema } = require("../validations/users.validation");
const UsersService = require("../services/users.service");

async function me(req, res) {
    try {
        const data = await UsersService.getMe({ userId: req.user.userId });
        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("USER ME ERROR:", e?.message, e?.stack);
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

async function updateProfile(req, res) {
    try {
        const body = updateProfileSchema.parse(req.body);

        const data = await UsersService.updateProfile({
            userId: req.user.userId,
            full_name: body.full_name ?? null,
            email: body.email ?? null,
            fcm_token: body.fcm_token ?? null,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        console.error("UPDATE PROFILE ERROR:", {
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

module.exports = {
    me,
    updateProfile,
};
