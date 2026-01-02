const { Op } = require("sequelize");
const env = require("../config/env");
const { AppError } = require("../utils/errors");
const { sendOtpViaMsg91, verifyOtpViaMsg91 } = require("./otp.service");
const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    hashRefreshToken,
} = require("./token.service");

const { sequelize, User, OtpRequest, UserSession } = require("../models");

function nowPlusMinutes(mins) {
    return new Date(Date.now() + mins * 60 * 1000);
}

async function enforceOtpRateLimit({ phone }) {
    // Rule: max 3 OTP sends per phone per 15 minutes
    const since = new Date(Date.now() - 15 * 60 * 1000);

    const count = await OtpRequest.count({
        where: {
            phone,
            purpose: "login",
            created_at: { [Op.gte]: since },
        },
    });

    if (count >= 3) {
        throw new AppError("RATE_LIMITED", "Too many OTP requests. Try later.", 429);
    }
}

async function sendOtp({ phone, purpose, ipAddress, userAgent }) {
    await enforceOtpRateLimit({ phone });

    const expiresAt = nowPlusMinutes(env.OTP_EXPIRY_MINUTES);

    const otpReq = await OtpRequest.create({
        phone,
        provider: "msg91",
        provider_request_id: null,
        purpose,
        status: "sent",
        attempt_count: 0,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt,
    });

    const providerResp = await sendOtpViaMsg91({
        phone,
        otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
    });

    await otpReq.update({
        provider_request_id: providerResp.provider_request_id,
    });

    return {
        otp_request_id: otpReq.id,
        expires_in_seconds: providerResp.expires_in_seconds,
    };
}

async function verifyOtp({ otp_request_id, phone, otp, device, ipAddress, userAgent }) {
    const otpReq = await OtpRequest.findOne({
        where: { id: otp_request_id, phone, purpose: "login" },
    });

    if (!otpReq) {
        throw new AppError("OTP_REQUEST_NOT_FOUND", "OTP request not found", 404);
    }

    if (otpReq.status === "verified") {
        // Idempotent-ish behavior: treat as already verified
        // but still require login flow. You can tighten this if needed.
    }

    if (otpReq.expires_at && new Date(otpReq.expires_at).getTime() < Date.now()) {
        await otpReq.update({ status: "expired" });
        throw new AppError("OTP_EXPIRED", "OTP expired", 400);
    }

    if (otpReq.attempt_count >= 5) {
        await otpReq.update({ status: "failed" });
        throw new AppError("INVALID_OTP", "Too many attempts", 400);
    }

    // Increment attempt count before provider verify (prevents brute-force)
    await otpReq.update({ attempt_count: otpReq.attempt_count + 1 });

    // Provider verify (you must implement verifyOtpViaMsg91 for your integration)
    await verifyOtpViaMsg91({ phone, otp });

    // Provider OK => mark verified
    await otpReq.update({ status: "verified" });

    // Create/Load user
    let user = await User.findOne({ where: { phone } });
    if (!user) {
        user = await User.create({
            phone,
            status: "active",
            last_login_at: new Date(),
        });
    } else {
        if (user.status === "blocked") {
            throw new AppError("USER_BLOCKED", "User is blocked", 403);
        }
        await user.update({ last_login_at: new Date() });
    }

    // Create JWT tokens + store refresh session (hashed)
    const accessToken = signAccessToken({ userId: user.id, phone: user.phone });
    const refreshToken = signRefreshToken({ userId: user.id, phone: user.phone });

    const refreshHash = hashRefreshToken(refreshToken);

    // Use transaction for session create
    await sequelize.transaction(async (t) => {
        await UserSession.create(
            {
                user_id: user.id,
                refresh_token_hash: refreshHash,
                device_id: device?.device_id || null,
                device_name: device?.device_name || null,
                ip_address: ipAddress || null,
                user_agent: userAgent || null,
                is_revoked: false,
                revoked_at: null,
                // Optional: store expires_at if your model includes it
                // expires_at: ...
            },
            { transaction: t }
        );
    });

    return {
        user: {
            id: user.id,
            phone: user.phone,
            status: user.status,
        },
        tokens: {
            access_token: accessToken,
            access_expires_in_seconds: 15 * 60,
            refresh_token: refreshToken,
            refresh_expires_in_seconds: 30 * 24 * 60 * 60,
        },
    };
}

async function refreshAccessToken({ refresh_token, device_id }) {
    // Validate signature & expiry
    let decoded;
    try {
        decoded = verifyRefreshToken(refresh_token);
    } catch (e) {
        throw new AppError("INVALID_REFRESH_TOKEN", "Invalid/expired refresh token", 401);
    }

    const refreshHash = hashRefreshToken(refresh_token);

    const session = await UserSession.findOne({
        where: {
            refresh_token_hash: refreshHash,
            is_revoked: false,
        },
    });

    if (!session) {
        throw new AppError("SESSION_REVOKED", "Session not found or revoked", 401);
    }

    if (device_id && session.device_id && device_id !== session.device_id) {
        // Optional stricter check
        // throw new AppError("INVALID_REFRESH_TOKEN", "Device mismatch", 401);
    }

    const accessToken = signAccessToken({
        userId: decoded.userId,
        phone: decoded.phone,
    });

    return {
        access_token: accessToken,
        access_expires_in_seconds: 15 * 60,
    };
}

async function logout({ userId, refresh_token }) {
    const refreshHash = hashRefreshToken(refresh_token);

    const session = await UserSession.findOne({
        where: {
            user_id: userId,
            refresh_token_hash: refreshHash,
            is_revoked: false,
        },
    });

    if (!session) {
        // Idempotent logout
        return { logged_out: true };
    }

    await session.update({
        is_revoked: true,
        revoked_at: new Date(),
    });

    return { logged_out: true };
}

async function getMe({ userId }) {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name || null,
            status: user.status,
            created_at: user.created_at,
        },
    };
}

module.exports = {
    sendOtp,
    verifyOtp,
    refreshAccessToken,
    logout,
    getMe,
};
