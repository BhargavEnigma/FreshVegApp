"use strict";

const crypto = require("crypto");
const { sequelize, Payment, Order, OrderStatusEvent } = require("../models");
const { AppError } = require("../utils/errors");

// IST helpers (kept local to avoid cross-service imports)
function getIstYyyyMmDd() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;

    return `${y}-${m}-${d}`;
}

function addDays(yyyyMmDd, days) {
    const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function timingSafeEqualHex(a, b) {
    const ba = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

function verifyWebhookSignature({ rawBody, signature, secret }) {
    if (!secret) return true; // allow disabling in dev
    if (!signature) return false;

    const computed = crypto
        .createHmac("sha256", secret)
        .update(String(rawBody || ""), "utf8")
        .digest("hex");

    return timingSafeEqualHex(computed, signature);
}

async function handleWebhook({ headers, payload, rawBody }) {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || null;

    // Common headers (Razorpay uses x-razorpay-signature)
    const signature =
        headers["x-razorpay-signature"] ||
        headers["x-webhook-signature"] ||
        headers["x-signature"] ||
        null;

    const ok = verifyWebhookSignature({ rawBody, signature, secret: webhookSecret });
    if (!ok) {
        throw new AppError("INVALID_SIGNATURE", "Invalid webhook signature", 401);
    }

    const provider = payload.provider || "gateway";
    const provider_payment_id = payload.provider_payment_id || payload.payment_id || null;
    const order_id = payload.order_id || null;
    const status = String(payload.status || "").toLowerCase();

    if (!order_id && !provider_payment_id) {
        return { received: true, ignored: true };
    }

    return sequelize.transaction(async (t) => {
        let payment = null;

        if (provider_payment_id) {
            payment = await Payment.findOne({
                where: { provider_payment_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        if (!payment && order_id) {
            payment = await Payment.findOne({
                where: { order_id },
                order: [["created_at", "DESC"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        if (!payment) {
            payment = await Payment.create(
                {
                    order_id,
                    method: payload.method || "upi",
                    status: status || "pending",
                    amount_paise: Number(payload.amount_paise || 0),
                    provider,
                    provider_payment_id,
                    provider_payload: payload,
                },
                { transaction: t }
            );
        }

        const finalStates = ["paid", "failed", "refunded"];
        if (finalStates.includes(payment.status)) {
            return { received: true, idempotent: true };
        }

        await payment.update(
            {
                status: status || payment.status,
                provider,
                provider_payment_id: provider_payment_id || payment.provider_payment_id,
                provider_payload: payload,
            },
            { transaction: t }
        );

        if (payment.order_id) {
            const order = await Order.findByPk(payment.order_id, {
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (order) {
                let newPaymentStatus = order.payment_status;
                if (status === "paid") newPaymentStatus = "paid";
                if (status === "failed") newPaymentStatus = "failed";
                if (status === "refunded") newPaymentStatus = "refunded";

                const oldOrderStatus = order.status;

                let newOrderStatus = oldOrderStatus;

                // If a UPI payment succeeds AFTER midnight IST of the delivery_date,
                // we reschedule the delivery to the next day to avoid disrupting warehouse ops.
                const nowIst = getIstYyyyMmDd();
                const shouldRescheduleOnPaid =
                    status === "paid" &&
                    oldOrderStatus === "payment_pending" &&
                    order.delivery_date &&
                    String(nowIst) >= String(order.delivery_date);

                const deliveryDateOld = order.delivery_date;
                const deliveryDateNew = shouldRescheduleOnPaid ? addDays(nowIst, 1) : deliveryDateOld;

                if (status === "paid" && oldOrderStatus === "payment_pending") {
                    newOrderStatus = "placed";
                }

                const orderUpdate = {
                    payment_status: newPaymentStatus,
                    status: newOrderStatus,
                };

                if (shouldRescheduleOnPaid) {
                    orderUpdate.delivery_date = deliveryDateNew;

                    // Ensure it is eligible to be locked on the new delivery day
                    orderUpdate.is_locked = false;
                    orderUpdate.locked_at = null;
                }

                await order.update(orderUpdate, { transaction: t });

                await OrderStatusEvent.create(
                    {
                        order_id: order.id,
                        from_status: oldOrderStatus,
                        to_status: newOrderStatus,
                        actor_user_id: null,
                        note: "payment_webhook",
                        meta: {
                            payment_status: newPaymentStatus,
                            provider,
                            provider_payment_id,
                            delivery_date_old: deliveryDateOld,
                            delivery_date_new: deliveryDateNew,
                            rescheduled_due_to_late_payment: Boolean(shouldRescheduleOnPaid),
                        },
                    },
                    { transaction: t }
                );

                await OrderStatusEvent.create(
                    {
                        order_id: order.id,
                        from_status: oldOrderStatus,
                        to_status: newOrderStatus,
                        actor_user_id: null,
                        note: "payment_webhook",
                        meta: { payment_status: newPaymentStatus, provider, provider_payment_id },
                    },
                    { transaction: t }
                );
            }
        }

        return { received: true };
    });
}

module.exports = { handleWebhook };