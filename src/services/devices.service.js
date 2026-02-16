"use strict";

const { Op } = require("sequelize");
const { AppError } = require("../utils/errors");
const { UserDevice, User } = require("../models");

function normalizePlatform(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().toLowerCase();
    if (!s) return null;
    if (!["android", "ios", "web"].includes(s)) return null;
    return s;
}

function normalizeDeviceId(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}

function normalizeFcmToken(v) {
    const s = String(v || "").trim();
    return s.length ? s : null;
}

async function registerDevice({ userId, device_id, platform, fcm_token }) {
    const token = normalizeFcmToken(fcm_token);
    if (!token) {
        throw new AppError("VALIDATION_ERROR", "fcm_token is required", 400);
    }

    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    if (user.status === "blocked") {
        throw new AppError("USER_BLOCKED", "User is blocked", 403);
    }

    const deviceId = normalizeDeviceId(device_id);
    const plt = normalizePlatform(platform);

    // If token exists for a different user, reclaim it to this user (device re-login).
    // This is safe because FCM tokens are per-install and should belong to the current account.
    const existingByToken = await UserDevice.findOne({
        where: { fcm_token: token },
    });

    if (existingByToken) {
        if (String(existingByToken.user_id) !== String(userId)) {
            await existingByToken.update({
                user_id: userId,
                device_id: deviceId,
                platform: plt,
                is_active: true,
                disabled_reason: null,
                last_seen_at: new Date(),
            });
        } else {
            await existingByToken.update({
                device_id: deviceId,
                platform: plt,
                is_active: true,
                disabled_reason: null,
                last_seen_at: new Date(),
            });
        }

        // Backward compatibility (legacy single-token storage)
        if (user.fcm_token !== token) {
            await user.update({ fcm_token: token });
        }

        return {
            device: {
                id: existingByToken.id,
                device_id: existingByToken.device_id,
                platform: existingByToken.platform,
                is_active: existingByToken.is_active,
                last_seen_at: existingByToken.last_seen_at,
            },
            idempotent: true,
        };
    }

    // If device_id provided, upsert by (user_id, device_id)
    if (deviceId) {
        const existingByDevice = await UserDevice.findOne({
            where: { user_id: userId, device_id: deviceId },
        });

        if (existingByDevice) {
            await existingByDevice.update({
                fcm_token: token,
                platform: plt,
                is_active: true,
                disabled_reason: null,
                last_seen_at: new Date(),
            });

            if (user.fcm_token !== token) {
                await user.update({ fcm_token: token });
            }

            return {
                device: {
                    id: existingByDevice.id,
                    device_id: existingByDevice.device_id,
                    platform: existingByDevice.platform,
                    is_active: existingByDevice.is_active,
                    last_seen_at: existingByDevice.last_seen_at,
                },
                idempotent: true,
            };
        }
    }

    const created = await UserDevice.create({
        user_id: userId,
        device_id: deviceId,
        platform: plt,
        fcm_token: token,
        is_active: true,
        disabled_reason: null,
        last_seen_at: new Date(),
    });

    // Backward compatibility for legacy code paths
    if (user.fcm_token !== token) {
        await user.update({ fcm_token: token });
    }

    return {
        device: {
            id: created.id,
            device_id: created.device_id,
            platform: created.platform,
            is_active: created.is_active,
            last_seen_at: created.last_seen_at,
        },
    };
}

async function unregisterDevice({ userId, device_id, fcm_token }) {
    const deviceId = normalizeDeviceId(device_id);
    const token = normalizeFcmToken(fcm_token);

    if (!deviceId && !token) {
        throw new AppError("VALIDATION_ERROR", "device_id or fcm_token is required", 400);
    }

    const where = { user_id: userId };

    if (deviceId) {
        where.device_id = deviceId;
    }
    if (token) {
        where.fcm_token = token;
    }

    const rows = await UserDevice.findAll({ where });
    if (!rows.length) {
        return { removed: 0 };
    }

    for (const row of rows) {
        await row.update({
            is_active: false,
            disabled_reason: "logout",
            last_seen_at: new Date(),
        });
    }

    // Best-effort: if legacy users.fcm_token matches the removed token, clear it.
    if (token) {
        const user = await User.findByPk(userId);
        if (user && user.fcm_token && String(user.fcm_token) === String(token)) {
            await user.update({ fcm_token: null });
        }
    }

    return { removed: rows.length };
}

async function listMyDevices({ userId }) {
    const rows = await UserDevice.findAll({
        where: { user_id: userId },
        order: [["updated_at", "DESC"]],
    });

    return {
        devices: rows.map((d) => ({
            id: d.id,
            device_id: d.device_id,
            platform: d.platform,
            is_active: d.is_active,
            disabled_reason: d.disabled_reason,
            last_seen_at: d.last_seen_at,
            created_at: d.created_at,
            updated_at: d.updated_at,
        })),
    };
}

async function disableTokens({ tokens, reason }) {
    if (!tokens || !tokens.length) return { disabled: 0 };

    const [count] = await UserDevice.update(
        { is_active: false, disabled_reason: reason || "invalid" },
        { where: { fcm_token: { [Op.in]: tokens } } }
    );

    return { disabled: Number(count || 0) };
}

module.exports = {
    registerDevice,
    unregisterDevice,
    listMyDevices,
    disableTokens,
};
