"use strict";

const { AppError } = require("../utils/errors");
const { User, UserRole, UserDevice } = require("../models");
const DevicesService = require("./devices.service");

function normalizeEmail(email) {
    if (email === null || email === undefined) {
        return email;
    }

    const v = String(email).trim().toLowerCase();
    return v.length ? v : null;
}

async function getMe({ userId }) {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    // ✅ Blueprint v1.2: expose roles for app behavior (customer vs admin/warehouse_manager)
    const rolesRows = await UserRole.findAll({
        where: { user_id: userId },
        attributes: ["role"],
    });

    const roles = rolesRows.map((r) => r.role);

    const devices = await UserDevice.findAll({
        where: { user_id: userId, is_active: true },
        attributes: ["fcm_token"],
    });

    const fcm_tokens = Array.from(new Set((devices || []).map((d) => d.fcm_token).filter(Boolean)));

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name ?? null,
            email: user.email ?? null,
            status: user.status,
            roles,
            // Backward compatibility (legacy single-token storage)
            fcm_token: user.fcm_token ?? null,
            // Preferred multi-device tokens
            fcm_tokens,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login_at: user.last_login_at ?? null,
        },
    };
}

async function updateProfile({ userId, full_name, email, fcm_token }) {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    if (user.status === "blocked") {
        throw new AppError("USER_BLOCKED", "User is blocked", 403);
    }

    const payload = {};

    // Keep same behavior: allow setting null to clear
    if (full_name !== undefined) {
        payload.full_name = full_name;
    }

    if (email !== undefined) {
        payload.email = normalizeEmail(email);
    }

    // ⚠️ Legacy behavior kept for backward compatibility:
    // Previously, profile update accepted fcm_token and overwrote users.fcm_token.
    // Now we ALSO register it in user_devices (multi-device safe).
    if (fcm_token !== undefined) {
        payload.fcm_token = fcm_token;
    }

    // If nothing to update, still return current user
    if (Object.keys(payload).length > 0) {
        await user.update(payload);
    }

    // If fcm_token provided, upsert into user_devices as well (best effort)
    if (fcm_token !== undefined && fcm_token !== null) {
        try {
            await DevicesService.registerDevice({
                userId,
                device_id: null,
                platform: null,
                fcm_token,
            });
        } catch (e) {
            // Don't fail profile update due to push-token registration
            console.error("FCM TOKEN UPSERT (legacy profile) FAILED:", e);
        }
    }

    const rolesRows = await UserRole.findAll({
        where: { user_id: userId },
        attributes: ["role"],
    });

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name ?? null,
            email: user.email ?? null,
            status: user.status,
            roles: rolesRows.map((r) => r.role),
            fcm_token: user.fcm_token ?? null,
            updated_at: user.updated_at,
        },
    };
}

module.exports = {
    getMe,
    updateProfile,
};
