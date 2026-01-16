"use strict";

const cron = require("node-cron");
const { Op } = require("sequelize");
const { Notification, User, sequelize } = require("../models");
const { sendPushToToken } = require("../services/push.service");

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
async function claimQueued({ batchSize = 50 } = {}) {
    return sequelize.transaction(async (t) => {
        const rows = await Notification.findAll({
            where: {
                channel: "push",
                status: "queued",
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
            const token = user?.fcm_token || null;

            if (!token) {
                await n.update({
                    status: "failed",
                    last_error: "USER_HAS_NO_FCM_TOKEN",
                    attempt_count: n.attempt_count + 1,
                });
                continue;
            }

            const push = buildPushFromTemplate(n);
            const result = await sendPushToToken({
                token,
                title: push.title,
                body: push.body,
                data: push.data,
            });

            if (result.ok) {
                await n.update({ status: "sent", sent_at: new Date(), last_error: null });
            } else {
                await n.update({
                    status: "failed",
                    attempt_count: n.attempt_count + 1,
                    last_error: String(result.error || "SEND_FAILED"),
                });
            }
        } catch (e) {
            const msg = String(e?.message || e);

            if (msg.includes("registration-token-not-registered") || msg.includes("invalid-registration-token")) {
                try {
                    const user = await User.findByPk(n.user_id);
                    if (user) await user.update({ fcm_token: null });
                } catch (_) {}
            }

            await n.update({
                status: "failed",
                attempt_count: n.attempt_count + 1,
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