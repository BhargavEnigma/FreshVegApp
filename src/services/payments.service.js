"use strict";

const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");

const { sequelize, Payment, Order, OrderStatusEvent } = require("../models");
const { AppError } = require("../utils/errors");

// =========================
// IST helpers
// =========================
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

// =========================
// Crypto helpers
// =========================
function timingSafeEqualHex(a, b) {
    const ba = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

function verifyWebhookSignature({ rawBody, signature, secret }) {
    // allow disabling in dev
    if (!secret) return true;
    if (!signature) return false;

    const computed = crypto
        .createHmac("sha256", secret)
        .update(String(rawBody || ""), "utf8")
        .digest("hex");

    return timingSafeEqualHex(computed, signature);
}

function verifyRazorpayCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret }) {
    if (!keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Razorpay key secret is missing", 500);
    }
    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const computed = crypto.createHmac("sha256", keySecret).update(message, "utf8").digest("hex");
    return timingSafeEqualHex(computed, razorpay_signature);
}

// =========================
// Razorpay REST API helper
// =========================
function getRazorpayAuth() {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    return { keyId, keySecret };
}

async function razorpayCreateRefund({ razorpayPaymentId, amountPaise, notes }) {
    const { keyId, keySecret } = getRazorpayAuth();

    if (!keyId || !keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay credentials", 500);
    }

    const url = `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/refund`;

    try {
        const resp = await axios.post(
            url,
            {
                amount: amountPaise ? Number(amountPaise) : undefined,
                notes: notes || {},
            },
            {
                auth: { username: keyId, password: keySecret },
                timeout: 15000,
            }
        );

        return resp.data;
    } catch (e) {
        const status = e?.response?.status || 500;
        const msg = e?.response?.data?.error?.description || e?.message || "Failed to create Razorpay refund";
        throw new AppError("RAZORPAY_REFUND_FAILED", msg, status);
    }
}

async function razorpayCreateGatewayOrder({ amountPaise, currency, receipt, notes }) {
    const { keyId, keySecret } = getRazorpayAuth();

    if (!keyId || !keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay credentials", 500);
    }

    const url = "https://api.razorpay.com/v1/orders";

    try {
        const resp = await axios.post(
            url,
            {
                amount: Number(amountPaise),
                currency: currency || "INR",
                receipt: String(receipt || ""),
                notes: notes || {},
            },
            {
                auth: { username: keyId, password: keySecret },
                timeout: 15000,
            }
        );

        return resp.data;
    } catch (e) {
        const status = e?.response?.status || 500;
        const msg = e?.response?.data?.error?.description || e?.message || "Failed to create Razorpay order";
        throw new AppError("RAZORPAY_ORDER_CREATE_FAILED", msg, status);
    }
}

// =========================
// Webhook normalization
// =========================
function isRazorpayWebhookPayload(payload) {
    return Boolean(payload && typeof payload === "object" && payload.event && payload.payload);
}

function normalizeRazorpayWebhook(payload) {
    // Razorpay webhook shape:
    // {
    //   entity: 'event',
    //   account_id: 'acc_...',
    //   event: 'payment.captured',
    //   contains: ['payment'],
    //   payload: { payment: { entity: { id, order_id, amount, status, ... } }, ... },
    //   created_at: 123
    // }

    const event = String(payload?.event || "").toLowerCase();
    const eventId = payload?.id ? String(payload.id) : null;

    const paymentEntity = payload?.payload?.payment?.entity || null;
    const orderEntity = payload?.payload?.order?.entity || null;
    const refundEntity = payload?.payload?.refund?.entity || null;

    // Prefer payment entity when present
    const provider_payment_id = paymentEntity?.id ? String(paymentEntity.id) : null;
    const provider_order_id = (paymentEntity?.order_id || orderEntity?.id) ? String(paymentEntity?.order_id || orderEntity?.id) : null;

    const amount_paise = Number(
        paymentEntity?.amount ??
        refundEntity?.amount ??
        orderEntity?.amount ??
        0
    );

    let status = "pending";

    if (event === "payment.captured" || event === "order.paid") status = "paid";
    else if (event === "payment.failed") status = "failed";
    else if (event.startsWith("refund.")) status = "refunded";
    else if (paymentEntity?.status) {
        const s = String(paymentEntity.status).toLowerCase();
        if (s === "captured") status = "paid";
        else if (s === "failed") status = "failed";
        else status = "pending";
    }

    // Optionally, allow mapping to FV order_id via notes
    const notes = paymentEntity?.notes || orderEntity?.notes || {};
    const fv_order_id = notes?.fv_order_id || notes?.order_id || null;

    return {
        provider: "razorpay",
        provider_event_id: eventId,
        event,
        status,
        order_id: fv_order_id,
        provider_order_id,
        provider_payment_id,
        method: "online",
        amount_paise,
        provider_payload: payload,
    };
}

function normalizeGenericWebhook(payload) {
    return {
        provider: payload.provider || "gateway",
        provider_event_id: payload.provider_event_id || payload.event_id || null,
        event: payload.event || null,
        status: String(payload.status || "").toLowerCase(),
        order_id: payload.order_id || null,
        provider_order_id: payload.provider_order_id || null,
        provider_payment_id: payload.provider_payment_id || payload.payment_id || null,
        method: payload.method || "online",
        amount_paise: Number(payload.amount_paise || 0),
        provider_payload: payload,
    };
}

// =========================
// Core DB update logic
// =========================
async function applyPaymentUpdate({ normalized, t }) {
    const finalStates = new Set(["paid", "failed", "refunded"]);

    const provider = normalized.provider || "gateway";
    const provider_payment_id = normalized.provider_payment_id || null;
    const provider_order_id = normalized.provider_order_id || null;
    const provider_event_id = normalized.provider_event_id || null;
    const order_id = normalized.order_id || null;
    const status = String(normalized.status || "pending").toLowerCase();

    // 1) Find payment row (prefer payment id, then provider order id, then FV order id)
    let payment = null;

    if (provider_payment_id) {
        payment = await Payment.findOne({
            where: { provider, provider_payment_id },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
    }

    if (!payment && provider_order_id) {
        payment = await Payment.findOne({
            where: { provider, provider_order_id },
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

    // 2) If still not found, create ONLY if we have FV order_id
    if (!payment) {
        if (!order_id) {
            return { received: true, ignored: true, reason: "cannot_create_payment_without_order_id" };
        }

        payment = await Payment.create(
            {
                order_id,
                method: normalized.method || "online",
                status: status || "pending",
                amount_paise: Number(normalized.amount_paise || 0),
                provider,
                provider_payment_id,
                provider_order_id,
                provider_event_id,
                provider_payload: normalized.provider_payload || null,
            },
            { transaction: t }
        );
    }

    // 3) Webhook-event idempotency (best effort)
    if (provider_event_id && payment.provider_event_id && String(payment.provider_event_id) === String(provider_event_id)) {
        return { received: true, idempotent: true, reason: "duplicate_event" };
    }

    // 4) Final state idempotency
    if (finalStates.has(payment.status)) {
        // If already final, do not mutate anything
        return { received: true, idempotent: true, reason: "already_final" };
    }

    // 5) Update payment
    await payment.update(
        {
            status: status || payment.status,
            provider,
            provider_payment_id: provider_payment_id || payment.provider_payment_id,
            provider_order_id: provider_order_id || payment.provider_order_id,
            provider_event_id: provider_event_id || payment.provider_event_id,
            provider_payload: normalized.provider_payload || payment.provider_payload,
        },
        { transaction: t }
    );

    // 6) Update order + status event
    const effectiveOrderId = payment.order_id;
    if (!effectiveOrderId) {
        return { received: true };
    }

    const order = await Order.findByPk(effectiveOrderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    if (!order) {
        return { received: true, ignored: true, reason: "order_not_found" };
    }

    const oldOrderStatus = order.status;
    const oldPaymentStatus = order.payment_status;

    // Map payment status
    let newPaymentStatus = oldPaymentStatus;
    if (status === "paid") newPaymentStatus = "paid";
    if (status === "failed") newPaymentStatus = "failed";
    if (status === "refunded") newPaymentStatus = "refunded";

    // Map order status
    let newOrderStatus = oldOrderStatus;
    if (status === "paid" && oldOrderStatus === "payment_pending") {
        newOrderStatus = "placed";
    }

    // Late-paid reschedule rule (preserve existing behavior)
    const nowIst = getIstYyyyMmDd();
    const shouldRescheduleOnPaid =
        status === "paid" &&
        oldOrderStatus === "payment_pending" &&
        order.delivery_date &&
        String(nowIst) >= String(order.delivery_date);

    const deliveryDateOld = order.delivery_date;
    const deliveryDateNew = shouldRescheduleOnPaid ? addDays(nowIst, 1) : deliveryDateOld;

    const orderUpdate = {};
    if (newPaymentStatus !== oldPaymentStatus) orderUpdate.payment_status = newPaymentStatus;
    if (newOrderStatus !== oldOrderStatus) orderUpdate.status = newOrderStatus;

    if (shouldRescheduleOnPaid) {
        orderUpdate.delivery_date = deliveryDateNew;
        orderUpdate.is_locked = false;
        orderUpdate.locked_at = null;
    }

    // If nothing changes, don't create a status event.
    const hasMeaningfulChange =
        Object.keys(orderUpdate).length > 0 || Boolean(shouldRescheduleOnPaid);

    if (hasMeaningfulChange) {
        await order.update(orderUpdate, { transaction: t });

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: oldOrderStatus,
                to_status: newOrderStatus,
                actor_user_id: null,
                note: "payment_webhook",
                meta: {
                    payment_status_old: oldPaymentStatus,
                    payment_status_new: newPaymentStatus,
                    provider,
                    provider_order_id,
                    provider_payment_id,
                    event: normalized.event || null,
                    delivery_date_old: deliveryDateOld,
                    delivery_date_new: deliveryDateNew,
                    rescheduled_due_to_late_payment: Boolean(shouldRescheduleOnPaid),
                },
            },
            { transaction: t }
        );
    }

    return { received: true };
}

// =========================
// Public API: Webhook entry
// =========================
async function handleWebhook({ headers, payload, rawBody }) {
    const webhookSecret =
        String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim() ||
        String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim() ||
        null;

    const signature =
        headers["x-razorpay-signature"] ||
        headers["x-webhook-signature"] ||
        headers["x-signature"] ||
        null;

    const ok = verifyWebhookSignature({ rawBody, signature, secret: webhookSecret });
    if (!ok) {
        throw new AppError("INVALID_SIGNATURE", "Invalid webhook signature", 401);
    }

    const normalized = isRazorpayWebhookPayload(payload)
        ? normalizeRazorpayWebhook(payload)
        : normalizeGenericWebhook(payload);

    // If we can't map to FV order_id, we'll still try via provider ids.
    return sequelize.transaction(async (t) => applyPaymentUpdate({ normalized, t }));
}

// =========================
// Razorpay: create order (server-side)
// =========================
async function razorpayCreateOrder({ userId, orderId }) {
    const { keyId } = getRazorpayAuth();
    if (!keyId) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay key id", 500);
    }

    return sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { id: orderId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        if (order.payment_status === "paid") {
            throw new AppError("ORDER_ALREADY_PAID", "Order is already paid", 400);
        }

        if (order.status !== "payment_pending") {
            // Payment can be initiated only for payment_pending orders
            throw new AppError("ORDER_NOT_PAYABLE", `Order is not payable in status: ${order.status}`, 400);
        }

        if (order.payment_method !== "online") {
            throw new AppError("INVALID_PAYMENT_METHOD", "This order is not configured for online payment", 400);
        }

        // If we already created a Razorpay order and payment is still pending, return it (idempotent)
        const existingPayment = await Payment.findOne({
            where: {
                order_id: order.id,
                provider: "razorpay",
                provider_order_id: { [Op.ne]: null },
                status: "pending",
            },
            order: [["created_at", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (existingPayment && existingPayment.provider_order_id) {
            return {
                key_id: keyId,
                order_id: order.id,
                razorpay_order_id: existingPayment.provider_order_id,
                amount_paise: order.total_paise,
                currency: "INR",
                idempotent: true,
            };
        }

        const gatewayOrder = await razorpayCreateGatewayOrder({
            amountPaise: order.total_paise,
            currency: "INR",
            receipt: order.order_number || order.id,
            notes: {
                fv_order_id: String(order.id),
                fv_order_number: order.order_number ? String(order.order_number) : undefined,
            },
        });

        const razorpay_order_id = String(gatewayOrder.id);

        // Create/Update payment row

        const latestPendingPayment = await Payment.findOne({
            where: {
                order_id: order.id,
                status: "pending",
                method: "online",
            },
            order: [["created_at", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        let payment;

        if (latestPendingPayment) {
            payment = await latestPendingPayment.update(
                {
                    provider: "razorpay",
                    provider_order_id: razorpay_order_id,
                    provider_payload: {
                        ...(latestPendingPayment.provider_payload || {}),
                        initiation: gatewayOrder,
                    },
                },
                { transaction: t }
            );
        } else {
            payment = await Payment.create(
                {
                    order_id: order.id,
                    method: "online",
                    status: "pending",
                    amount_paise: order.total_paise,
                    provider: "razorpay",
                    provider_order_id: razorpay_order_id,
                    provider_payload: { initiation: gatewayOrder },
                },
                { transaction: t }
            );
        }

        return {
            key_id: keyId,
            order_id: order.id,
            payment_id: payment.id,
            razorpay_order_id,
            amount_paise: order.total_paise,
            currency: String(gatewayOrder.currency || "INR"),
        };
    });
}

// =========================
// Razorpay: verify payment (server-side)
// =========================
async function razorpayVerifyPayment({ userId, payload }) {
    const { keySecret } = getRazorpayAuth();

    const ok = verifyRazorpayCheckoutSignature({
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature,
        keySecret,
    });

    if (!ok) {
        throw new AppError("INVALID_SIGNATURE", "Invalid Razorpay signature", 401);
    }

    return sequelize.transaction(async (t) => {
        // Ensure order belongs to the user
        const order = await Order.findOne({
            where: { id: payload.order_id, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        // If already paid, return idempotent success
        if (order.payment_status === "paid") {
            const existingPayment = await Payment.findOne({
                where: { order_id: order.id },
                order: [["created_at", "DESC"]],
                transaction: t,
            });

            return {
                verified: true,
                idempotent: true,
                order: {
                    id: order.id,
                    status: order.status,
                    payment_status: order.payment_status,
                },
                payment: existingPayment,
            };
        }

        // Find payment row by razorpay order id
        let payment = await Payment.findOne({
            where: {
                order_id: order.id,
                provider: "razorpay",
                provider_order_id: payload.razorpay_order_id,
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!payment) {
            // Fallback: any latest payment for this order
            payment = await Payment.findOne({
                where: { order_id: order.id },
                order: [["created_at", "DESC"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        if (!payment) {
            throw new AppError("PAYMENT_NOT_FOUND", "Payment row not found for this order", 404);
        }

        // Update Payment + Order using the same transition logic
        const normalized = {
            provider: "razorpay",
            provider_event_id: null,
            event: "verify_api",
            status: "paid",
            order_id: order.id,
            provider_order_id: payload.razorpay_order_id,
            provider_payment_id: payload.razorpay_payment_id,
            method: "online",
            amount_paise: order.total_paise,
            provider_payload: {
                verified: true,
                razorpay_order_id: payload.razorpay_order_id,
                razorpay_payment_id: payload.razorpay_payment_id,
                razorpay_signature: payload.razorpay_signature,
            },
        };

        await applyPaymentUpdate({ normalized, t });

        const updatedOrder = await Order.findByPk(order.id, { transaction: t });
        const updatedPayment = await Payment.findByPk(payment.id, { transaction: t });

        return {
            verified: true,
            order: {
                id: updatedOrder.id,
                status: updatedOrder.status,
                payment_status: updatedOrder.payment_status,
            },
            payment: updatedPayment,
        };
    });
}

module.exports = {
    handleWebhook,
    razorpayCreateOrder,
    razorpayVerifyPayment,
    razorpayCreateRefund
};