"use strict";

const cron = require("node-cron");
const { Op } = require("sequelize");
const { Notification, User, UserDevice, sequelize } = require("../models");
const { sendPushToTokens } = require("../services/push.service");
const DevicesService = require("../services/devices.service");

function buildPushFromTemplate(notificationRow) {
    const { template, payload } = notificationRow;

    if (template === "order_placed") {
        return {
            title: "Order placed ✅",
            body: `Your order is confirmed for ${payload.delivery_date}.`,
            data: { type: "order_placed", order_id: String(payload.order_id) },
        };
    }

    if (template === "order_status_changed") {
        return {
            title: "Order update",
            body: `Status changed: ${payload.from_status} → ${payload.to_status}`,
            data: {
                type: "order_status_changed",
                order_id: String(payload.order_id),
                from_status: String(payload.from_status),
                to_status: String(payload.to_status),
            },
        };
    }

    if (template === "order_locked") {
        return {
            title: "Order locked 🔒",
            body: `Your order is locked for ${payload.delivery_date} delivery.`,
            data: {
                type: "order_locked",
                order_id: String(payload.order_id),
                delivery_date: String(payload.delivery_date),
            },
        };
    }

    if (template === "order_cancelled") {
        return {
            title: "Order cancelled",
            body: "Your order was cancelled.",
            data: {
                type: "order_cancelled",
                order_id: payload?.order_id ? String(payload.order_id) : "",
            },
        };
    }

    return {
        title: "FreshVeg",
        body: "You have a new update.",
        data: { type: String(template || "generic") },
    };
}

/**
 * Claim queued notifications fast in a DB transaction, then process outside transaction.
 * Uses status = "processing" to avoid double-sends.
 */
const MAX_ATTEMPTS = Number.parseInt(process.env.NOTIFICATION_MAX_ATTEMPTS || "3", 10) || 3;

function computeBackoffMs(attemptCount) {
    // Simple linear backoff: 1st retry 1 min, then 5 min, then 15 min
    const n = Number(attemptCount || 0);
    if (n <= 0) return 0;
    if (n === 1) return 60 * 1000;
    if (n === 2) return 5 * 60 * 1000;
    return 15 * 60 * 1000;
}

async function claimQueued({ batchSize = 50 } = {}) {
    return sequelize.transaction(async (t) => {
        const rows = await Notification.findAll({
            where: {
                channel: "push",
                status: "queued",
                attempt_count: { [Op.lt]: MAX_ATTEMPTS },
                [Op.or]: [{ scheduled_at: null }, { scheduled_at: { [Op.lte]: new Date() } }],
            },
            order: [["created_at", "ASC"]],
            limit: batchSize,
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!rows.length) return [];

        const ids = rows.map((r) => r.id);

        await Notification.update(
            { status: "processing" },
            { where: { id: ids }, transaction: t }
        );

        return rows;
    });
}

async function processQueuedPushNotifications({ batchSize = 50 } = {}) {
    const rows = await claimQueued({ batchSize });
    if (!rows.length) return { processed: 0 };

    for (const n of rows) {
        try {
            const user = n.user_id ? await User.findByPk(n.user_id) : null;
            if (!user) {
                await n.update({
                    status: "failed",
                    last_error: "USER_NOT_FOUND",
                    attempt_count: n.attempt_count + 1,
                });
                continue;
            }

            const devices = await UserDevice.findAll({
                where: { user_id: user.id, is_active: true },
                attributes: ["fcm_token"],
            });

            // Backward compatibility (legacy users.fcm_token)
            const tokens = Array.from(
                new Set(
                    [
                        ...(devices || []).map((d) => d.fcm_token).filter(Boolean),
                        user.fcm_token || null,
                    ].filter(Boolean)
                )
            );

            if (!tokens.length) {
                await n.update({
                    status: "failed",
                    last_error: "USER_HAS_NO_FCM_TOKEN",
                    attempt_count: n.attempt_count + 1,
                });
                continue;
            }

            const push = buildPushFromTemplate(n);
            const result = await sendPushToTokens({
                tokens,
                title: push.title,
                body: push.body,
                data: push.data,
            });

            if (result.ok) {
                // Disable invalid tokens returned by FCM (best-effort)
                const invalidTokens = [];
                for (let i = 0; i < (result.responses || []).length; i++) {
                    const r = result.responses[i];
                    if (r && !r.success) {
                        const code = r.error?.code || "";
                        const msg = String(r.error?.message || "");

                        if (
                            String(code).includes("registration-token-not-registered") ||
                            String(code).includes("invalid-argument") ||
                            msg.includes("registration-token-not-registered") ||
                            msg.includes("invalid-registration-token")
                        ) {
                            invalidTokens.push(tokens[i]);
                        }
                    }
                }

                if (invalidTokens.length) {
                    await DevicesService.disableTokens({ tokens: invalidTokens, reason: "invalid_token" });
                    // Also clear legacy user.fcm_token if it is invalid
                    if (user.fcm_token && invalidTokens.includes(user.fcm_token)) {
                        await user.update({ fcm_token: null });
                    }
                }

                // Consider notification "sent" if at least one token succeeded.
                if (Number(result.success_count || 0) > 0) {
                    await n.update({ status: "sent", sent_at: new Date(), last_error: null });
                } else {
                    const nextAttempt = n.attempt_count + 1;
                    const backoffMs = computeBackoffMs(nextAttempt);
                    await n.update({
                        status: nextAttempt >= MAX_ATTEMPTS ? "failed" : "queued",
                        attempt_count: nextAttempt,
                        scheduled_at: backoffMs ? new Date(Date.now() + backoffMs) : null,
                        last_error: "ALL_TOKENS_FAILED",
                    });
                }
            } else {
                const nextAttempt = n.attempt_count + 1;
                const backoffMs = computeBackoffMs(nextAttempt);
                await n.update({
                    status: nextAttempt >= MAX_ATTEMPTS ? "failed" : "queued",
                    attempt_count: nextAttempt,
                    scheduled_at: backoffMs ? new Date(Date.now() + backoffMs) : null,
                    last_error: String(result.error || "SEND_FAILED"),
                });
            }
        } catch (e) {
            const msg = String(e?.message || e);

            const nextAttempt = n.attempt_count + 1;
            const backoffMs = computeBackoffMs(nextAttempt);

            await n.update({
                status: nextAttempt >= MAX_ATTEMPTS ? "failed" : "queued",
                attempt_count: nextAttempt,
                scheduled_at: backoffMs ? new Date(Date.now() + backoffMs) : null,
                last_error: msg.slice(0, 450),
            });
        }
    }

    return { processed: rows.length };
}

function startNotificationsWorker() {
    if (process.env.ENABLE_NOTIFICATIONS_WORKER !== "true") return;

    cron.schedule("* * * * *", async () => {
        try {
            const r = await processQueuedPushNotifications({ batchSize: 50 });
            if (r.processed) console.log(`[notifications.worker] processed=${r.processed}`);
        } catch (e) {
            console.error("[notifications.worker] failed", e);
        }
    });
}

module.exports = { startNotificationsWorker, processQueuedPushNotifications };
