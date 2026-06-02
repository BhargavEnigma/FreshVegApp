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
    const digits = String(phone || "").replace(/\D/g, "");
    if (/^\d{10}$/.test(digits)) {
        return `91${digits}`;
    }
    if (/^91\d{10}$/.test(digits)) {
        return digits;
    }
    return String(phone || "").trim();
}

async function enforceOtpRateLimit({ phone, purpose, ipAddress }) {
    const since = new Date(Date.now() - 60 * 1000);

    const where = {
        purpose,
        created_at: { [Op.gte]: since },
        [Op.or]: [{ phone }],
    };

    if (ipAddress) {
        where[Op.or].push({ ip_address: ipAddress, phone });
    }

    const count = await OtpRequest.count({ where });

    if (count >= 3) {
        throw new AppError("RATE_LIMITED", "Too many OTP requests. Try later.", 429);
    }
}

async function sendOtp({ phone, purpose, ipAddress, userAgent }) {
    const normalizedPhone = normalizePhone(phone);

    await enforceOtpRateLimit({ phone: normalizedPhone, purpose, ipAddress });

    const expiresAt = nowPlusMinutes(env?.otp?.msg91OTPexpiryMinutes);

    let providerResp;
    try {
        if (env.otp?.bypassEnabled) {
            providerResp = {
                opt_request_id: `dev_${Date.now()}`,
                expires_in_seconds: Number(env.otp.msg91OTPexpiryMinutes || 5) * 60,
            };
        } else {
            providerResp = await sendOtpViaMsg91({
                phone: normalizedPhone,
                otpExpiryMinutes: env.otp.msg91OTPexpiryMinutes,
            });
        }
    } catch (error) {
        await OtpRequest.create({
            phone: normalizedPhone,
            provider: "msg91",
            provider_request_id: null,
            purpose,
            status: "failed",
            attempt_count: 0,
            ip_address: ipAddress || null,
            user_agent: userAgent || null,
            expires_at: expiresAt,
        });
        throw error;
    }

    const otpReq = await OtpRequest.create({
        phone: normalizedPhone,
        provider: "msg91",
        provider_request_id: providerResp.provider_request_id,
        purpose,
        status: "sent",
        attempt_count: 0,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt,
    });

    return {
        otp_request_id: otpReq.id,
        expires_in_seconds: providerResp.expires_in_seconds,
    };
}

async function verifyOtp({ otp_request_id, phone, otp, device, fcm_token, ipAddress, userAgent }) {
    const normalizedPhone = normalizePhone(phone);
    const providedOtp = String(otp || "").trim();

    const bypassEnabled = env?.otp?.bypassEnabled === true;
    const bypassCode = String(env?.otp?.bypassCode || "").trim();
    const isBypassOtp = bypassEnabled && providedOtp === bypassCode;

    const otpReq = await OtpRequest.findOne({
        where: {
            id: otp_request_id,
            phone: normalizedPhone,
            purpose: "login",
        },
    });

    if (!otpReq) {
        throw new AppError("OTP_REQUEST_NOT_FOUND", "OTP request not found", 404);
    }

    if (otpReq.status === "verified") {
        throw new AppError("OTP_ALREADY_USED", "OTP already used", 400);
    }

    if (otpReq.status === "expired") {
        throw new AppError("OTP_EXPIRED", "OTP expired", 400);
    }

    if (otpReq.status === "failed") {
        throw new AppError("INVALID_OTP", "Too many attempts. Please request a new OTP.", 400);
    }

    if (otpReq.expires_at && new Date(otpReq.expires_at).getTime() < Date.now()) {
        await otpReq.update({ status: "expired" });
        throw new AppError("OTP_EXPIRED", "OTP expired", 400);
    }

    if (Number(otpReq.attempt_count || 0) >= 5) {
        await otpReq.update({ status: "failed" });
        throw new AppError("INVALID_OTP", "Too many attempts. Please request a new OTP.", 400);
    }

    await otpReq.update({
        attempt_count: Number(otpReq.attempt_count || 0) + 1,
        ip_address: ipAddress || otpReq.ip_address,
        user_agent: userAgent || otpReq.user_agent,
    });

    try {
        if (!isBypassOtp) {
            await verifyOtpViaMsg91({
                phone: normalizedPhone,
                otp: providedOtp,
                otpExpiryMinutes: env.otp.msg91OTPexpiryMinutes,
            });
        }
    } catch (error) {
        const freshOtpReq = await OtpRequest.findByPk(otpReq.id);

        if (Number(freshOtpReq?.attempt_count || 0) >= 5) {
            await freshOtpReq.update({ status: "failed" });
        }

        if (error instanceof AppError && error.code === "INVALID_OTP") {
            throw new AppError("INVALID_OTP", "Invalid OTP", 400);
        }

        throw error;
    }

    return sequelize.transaction(async (t) => {
        const lockedOtpReq = await OtpRequest.findOne({
            where: {
                id: otp_request_id,
                phone: normalizedPhone,
                purpose: "login",
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!lockedOtpReq || lockedOtpReq.status !== "sent") {
            throw new AppError("OTP_ALREADY_USED", "OTP already used or invalid", 400);
        }

        let user = await User.findOne({
            where: { phone: normalizedPhone },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!user) {
            user = await User.create(
                {
                    phone: normalizedPhone,
                    status: "active",
                    last_login_at: new Date(),
                    fcm_token: fcm_token ?? null,
                },
                { transaction: t }
            );
        } else {
            if (user.status === "blocked") {
                throw new AppError("USER_BLOCKED", "User is blocked", 403);
            }

            const updatePayload = { last_login_at: new Date() };

            if (fcm_token !== undefined) {
                updatePayload.fcm_token = fcm_token;
            }

            await user.update(updatePayload, { transaction: t });
        }

        const existingRoles = await UserRole.count({
            where: { user_id: user.id },
            transaction: t,
        });

        if (existingRoles === 0) {
            await UserRole.findOrCreate({
                where: { user_id: user.id, role: "customer" },
                defaults: { user_id: user.id, role: "customer" },
                transaction: t,
            });
        }

        const rolesRows = await UserRole.findAll({
            where: { user_id: user.id },
            attributes: ["role"],
            transaction: t,
        });

        const accessToken = createAccessToken({
            userId: user.id,
            phone: user.phone,
        });

        const refreshToken = createRefreshToken({
            userId: user.id,
            phone: user.phone,
        });

        await UserSession.create(
            {
                user_id: user.id,
                refresh_token_hash: hashRefreshToken(refreshToken),
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

        await lockedOtpReq.update(
            {
                status: "verified",
            },
            { transaction: t }
        );

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
                refresh_expires_in_seconds: env.jwt.refreshExpiresInDays * 24 * 60 * 60,
            },
        };
    });
}

async function refreshAccessToken({ refresh_token, device_id }) {
    let decoded;
    try {
        decoded = verifyRefreshToken(refresh_token);
    } catch (_e) {
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
        throw new AppError("REFRESH_TOKEN_EXPIRED", "Refresh session expired", 401);
    }

    if (device_id && session.device_id && device_id !== session.device_id) {
        throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token device mismatch", 401);
    }

    const user = await User.findByPk(decoded.userId, { attributes: ["id", "phone", "status"] });
    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    if (user.status !== "active") {
        throw new AppError("USER_BLOCKED", "User is blocked", 403);
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
