const ResponseUtil = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const {
    sendOtpSchema,
    verifyOtpSchema,
    refreshTokenSchema,
    logoutSchema,
} = require("../validations/auth.validation");

const AuthService = require("../services/auth.service");

function getClientMeta(req) {
    return {
        ipAddress: req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() || req.ip,
        userAgent: req.headers["user-agent"] || null,
    };
}

async function sendOtp(req, res) {
    try {
        const body = sendOtpSchema.parse(req.body);
        const meta = getClientMeta(req);

        const data = await AuthService.sendOtp({
            phone: body.phone,
            purpose: body.purpose,
            ...meta,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.code, e.message, e.httpStatus);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, "INVALID_PHONE", "Invalid request body", 400);
        }
        return ResponseUtil.fail(res, "PROVIDER_ERROR", "Something went wrong", 500);
    }
}

async function verifyOtp(req, res) {
    try {
        const body = verifyOtpSchema.parse(req.body);
        const meta = getClientMeta(req);

        const data = await AuthService.verifyOtp({
            otp_request_id: body.otp_request_id,
            phone: body.phone,
            otp: body.otp,
            device: body.device || null,
            ...meta,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.code, e.message, e.httpStatus);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, "INVALID_OTP", "Invalid request body", 400);
        }
        return ResponseUtil.fail(res, "PROVIDER_ERROR", "Something went wrong", 500);
    }
}

async function refreshToken(req, res) {
    try {
        const body = refreshTokenSchema.parse(req.body);

        const data = await AuthService.refreshAccessToken({
            refresh_token: body.refresh_token,
            device_id: body.device_id || null,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.code, e.message, e.httpStatus);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, "INVALID_REFRESH_TOKEN", "Invalid request body", 400);
        }
        return ResponseUtil.fail(res, "INVALID_REFRESH_TOKEN", "Unable to refresh token", 401);
    }
}

async function logout(req, res) {
    try {
        const body = logoutSchema.parse(req.body);

        const data = await AuthService.logout({
            userId: req.user.userId,
            refresh_token: body.refresh_token,
        });

        return ResponseUtil.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.code, e.message, e.httpStatus);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, "INVALID_REFRESH_TOKEN", "Invalid request body", 400);
        }
        return ResponseUtil.fail(res, "UNAUTHORIZED", "Unable to logout", 401);
    }
}

async function me(req, res) {
    try {
        const data = await AuthService.getMe({ userId: req.user.userId });
        return ResponseUtil.ok(res, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.code, e.message, e.httpStatus);
        }
        return ResponseUtil.fail(res, "USER_NOT_FOUND", "User not found", 404);
    }
}

module.exports = {
    sendOtp,
    verifyOtp,
    refreshToken,
    logout,
    me,
};