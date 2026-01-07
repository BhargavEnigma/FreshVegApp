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
        console.log("SEND OTP :", req.body);

        const body = sendOtpSchema.parse(req.body);
        const meta = getClientMeta(req);

        const data = await AuthService.sendOtp({
            phone: body.phone,
            purpose: body.purpose,
            ...meta,
        });

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        console.log('SEND ERROR : ', e);

        // ✅ AppError path (your services throw this)
        if (e instanceof AppError) {
            return ResponseUtil.fail(
                res,
                e.httpStatus || 500,
                e.code || "PROVIDER_ERROR",
                e.message || "Something went wrong",
                e.details || e?.response?.data || null
            );
        }

        // ✅ Zod validation
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "INVALID_PHONE", "Invalid request body", e.issues ?? null);
        }

        // ✅ Axios / unknown error
        const details = e?.response?.data || { message: e?.message };
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong", details);
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

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        console.log('ERROR VERIFY : ', e);

        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }

        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "INVALID_OTP", "Invalid request body", e.issues ?? null);
        }

        // Sequelize errors / unknown errors
        const details = e?.response?.data || e?.errors || { message: e?.message };
        return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong", details);
    }
}

async function refreshToken(req, res) {
    try {
        const body = refreshTokenSchema.parse(req.body);

        const data = await AuthService.refreshAccessToken({
            refresh_token: body.refresh_token,
            device_id: body.device_id || null,
        });

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }
        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "INVALID_REFRESH_TOKEN", "Invalid request body");
        }
        return ResponseUtil.fail(res, 401, "INVALID_REFRESH_TOKEN", "Unable to refresh token");
    }
}

async function logout(req, res) {
    try {
        const body = logoutSchema.parse(req.body);

        const data = await AuthService.logout({
            userId: req.user.userId,
            refresh_token: body.refresh_token,
        });

        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
        }

        if (e?.name === "ZodError") {
            return ResponseUtil.fail(res, 400, "INVALID_REFRESH_TOKEN", "Invalid request body");
        }
        return ResponseUtil.fail(res, 401, "UNAUTHORIZED", "Unable to logout");
    }
}

async function me(req, res) {
    try {
        const data = await AuthService.getMe({ userId: req.user.userId });
        return ResponseUtil.ok(res, 200, data);
    } catch (e) {
        if (e instanceof AppError) {
            return ResponseUtil.fail(res, e.httpStatus, e.code, e.message);
        }
        return ResponseUtil.fail(res, 404, "USER_NOT_FOUND", "User not found");
    }
}

module.exports = {
    sendOtp,
    verifyOtp,
    refreshToken,
    logout,
    me,
};