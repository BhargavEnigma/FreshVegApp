"use strict";

const { Op } = require("sequelize");
const { env } = require("../config/env");
const { AppError } = require("../utils/errors");
const { sendOtpViaMsg91, verifyOtpViaMsg91 } = require("./otp.service");
const {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken,
    hashRefreshToken,
    refreshExpiryDate,
} = require("./token.service");

const { sequelize, User, OtpRequest, UserSession, UserRole } = require("../models");

function nowPlusMinutes(mins) {
    const m = Number(mins);
    const safeMins = Number.isFinite(m) && m > 0 ? m : 5;
    return new Date(Date.now() + safeMins * 60 * 1000);
}

function normalizePhone(phone) {
    const v = String(phone || "").trim();
    if (/^\d{10}$/.test(v)) {
        return `91${v}`;
    }
    if (/^91\d{10}$/.test(v)) {
        return v;
    }
    return v;
}

async function enforceOtpRateLimit({ phone, purpose }) {
    const since = new Date(Date.now() - 15 * 60 * 1000);

    const count = await OtpRequest.count({
        where: {
            phone,
            purpose,
            created_at: { [Op.gte]: since },
        },
    });

    if (count >= 5) {
        throw new AppError("RATE_LIMITED", "Too many OTP requests. Try later.", 429);
    }
}

async function sendOtp({ phone, purpose, ipAddress, userAgent }) {
    const normalizedPhone = normalizePhone(phone);

    await enforceOtpRateLimit({ phone: normalizedPhone, purpose });

    const expiresAt = nowPlusMinutes(env?.otp?.msg91OTPexpiryMinutes);

    const otpReq = await OtpRequest.create({
        phone: normalizedPhone,
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
        phone: normalizedPhone,
        otpExpiryMinutes: env.otp.msg91OTPexpiryMinutes,
    });

    await otpReq.update({
        provider_request_id: providerResp.provider_request_id,
    });

    return {
        otp_request_id: otpReq.id,
        expires_in_seconds: providerResp.expires_in_seconds,
    };
}

async function verifyOtp({ otp_request_id, phone, otp, device, fcm_token, ipAddress, userAgent }) {
    const normalizedPhone = normalizePhone(phone);

    const otpReq = await OtpRequest.findOne({
        where: { id: otp_request_id, phone: normalizedPhone, purpose: "login" },
    });

    if (!otpReq) {
        throw new AppError("OTP_REQUEST_NOT_FOUND", "OTP request not found", 404);
    }

    // ✅ Prevent reuse (Blueprint wants clean flow)
    if (otpReq.status === "verified") {
        throw new AppError("OTP_ALREADY_USED", "OTP already used", 400);
    }

    if (otpReq.status === "expired") {
        throw new AppError("OTP_EXPIRED", "OTP expired", 400);
    }

    if (otpReq.expires_at && new Date(otpReq.expires_at).getTime() < Date.now()) {
        await otpReq.update({ status: "expired" });
        throw new AppError("OTP_EXPIRED", "OTP expired", 400);
    }

    if (otpReq.attempt_count >= 5) {
        await otpReq.update({ status: "failed" });
        throw new AppError("INVALID_OTP", "Too many attempts", 400);
    }

    const bypassEnabled = env.nodeEnv !== "production" && env?.otp?.bypassEnabled === true;
    const bypassCode = String(env?.otp?.bypassCode || "").trim();
    const providedOtp = String(otp || "").trim();
    const isBypassOtp = bypassEnabled && providedOtp === bypassCode;

    // ✅ Increment attempt count exactly ONCE per verify call
    await otpReq.update({ attempt_count: otpReq.attempt_count + 1 });

    if (!isBypassOtp) {
        await verifyOtpViaMsg91({ phone: normalizedPhone, otp: providedOtp });
    }

    // Provider OK => mark verified
    await otpReq.update({ status: "verified" });

    // Create/Load user
    let user = await User.findOne({ where: { phone: normalizedPhone } });

    if (!user) {
        user = await User.create({
            phone: normalizedPhone,
            status: "active",
            last_login_at: new Date(),
            fcm_token: fcm_token ?? null,
        });
    } else {
        if (user.status === "blocked") {
            throw new AppError("USER_BLOCKED", "User is blocked", 403);
        }

        const updatePayload = { last_login_at: new Date() };
        if (fcm_token !== undefined) {
            updatePayload.fcm_token = fcm_token;
        }

        await user.update(updatePayload);
    }

    // ✅ Ensure default role exists (Blueprint RBAC)
    const existingRoles = await UserRole.count({
        where: { user_id: user.id }
    });

    if (existingRoles === 0) {
        await UserRole.findOrCreate({
            where: { user_id: user.id, role: "customer" },
            defaults: { user_id: user.id, role: "customer" },
        });
    }


    const rolesRows = await UserRole.findAll({
        where: { user_id: user.id },
        attributes: ["role"],
    });

    // Create JWT tokens + store refresh session (hashed)
    const accessToken = createAccessToken({ userId: user.id, phone: user.phone });
    const refreshToken = createRefreshToken({ userId: user.id, phone: user.phone });

    const refreshHash = hashRefreshToken(refreshToken);

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
                expires_at: refreshExpiryDate(),
            },
            { transaction: t }
        );
    });

    return {
        user: {
            id: user.id,
            phone: user.phone,
            status: user.status,
            roles: rolesRows.map((r) => r.role),
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

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
        throw new AppError("INVALID_REFRESH_TOKEN", "Refresh session expired", 401);
    }

    if (device_id && session.device_id && device_id !== session.device_id) {
        // Optional stricter check (Blueprint doesn't forbid this)
        // throw new AppError("INVALID_REFRESH_TOKEN", "Device mismatch", 401);
    }

    let phone = decoded.phone;
    if (!phone) {
        const user = await User.findByPk(decoded.userId, { attributes: ["phone"] });
        phone = user?.phone || null;
    }

    const accessToken = createAccessToken({
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

    const rolesRows = await UserRole.findAll({
        where: { user_id: userId },
        attributes: ["role"],
    });

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name || null,
            email: user.email || null,
            fcm_token: user.fcm_token || null,
            status: user.status,
            roles: rolesRows.map((r) => r.role),
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
