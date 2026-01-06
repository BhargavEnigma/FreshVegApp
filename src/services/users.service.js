"use strict";

const { AppError } = require("../utils/errors");
const { User, UserRole } = require("../models");

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

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name ?? null,
            email: user.email ?? null,
            status: user.status,
            roles,
            fcm_token: user.fcm_token ?? null,
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

    // ✅ Blueprint v1.2 readiness: store token for push notifications
    if (fcm_token !== undefined) {
        payload.fcm_token = fcm_token;
    }

    // If nothing to update, still return current user
    if (Object.keys(payload).length > 0) {
        await user.update(payload);
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
