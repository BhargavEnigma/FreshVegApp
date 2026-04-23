"use strict";

const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");

const {
    sequelize,
    Order,
    Payment,
    PaymentAttempt,
    Refund,
    OrderStatusEvent,
    Notification,
} = require("../models");
const { AppError } = require("../utils/errors");

const ONLINE_RETRYABLE_PAYMENT_STATUSES = new Set([
    "pending",
    "provider_order_created",
    "verification_pending",
    "failed",
    "refund_failed",
]);

const TERMINAL_PAYMENT_STATUSES = new Set(["paid", "refunded", "refund_pending"]);
const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "refunded", "delivered"]);

// Get today's date in IST timezone in YYYY-MM-DD format.
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

// Add given number of days to a YYYY-MM-DD date and return new date.
function addDays(yyyyMmDd, days) {
    const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

// Compare two strings safely to avoid timing attack issues.
function timingSafeEqualHex(a, b) {
    const ba = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

// Check if webhook signature is valid or not.
function verifyWebhookSignature({ rawBody, signature, secret }) {
    if (!secret || !signature) return false;

    const computed = crypto
        .createHmac("sha256", secret)
        .update(String(rawBody || ""), "utf8")
        .digest("hex");

    return timingSafeEqualHex(computed, signature);
}

// Check Razorpay checkout success signature before accepting payment.
function verifyRazorpayCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret }) {
    if (!keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Razorpay key secret is missing", 500);
    }

    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const computed = crypto.createHmac("sha256", keySecret).update(message, "utf8").digest("hex");
    return timingSafeEqualHex(computed, razorpay_signature);
}

// Read Razorpay key id and secret from environment.
function getRazorpayAuth() {
    return {
        keyId: String(process.env.RAZORPAY_KEY_ID || "").trim(),
        keySecret: String(process.env.RAZORPAY_KEY_SECRET || "").trim(),
    };
}

// Create a new Razorpay gateway order for online payment.
async function razorpayCreateGatewayOrder({ amountPaise, currency, receipt, notes }) {
    const { keyId, keySecret } = getRazorpayAuth();

    if (!keyId || !keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay credentials", 500);
    }

    try {
        const resp = await axios.post(
            "https://api.razorpay.com/v1/orders",
            {
                amount: Number(amountPaise),
                currency: currency || "INR",
                receipt,
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
        throw new AppError("RAZORPAY_ORDER_CREATE_FAILED", msg, status >= 400 && status < 600 ? status : 500);
    }
}

// Create a refund request in Razorpay for a paid payment.
async function razorpayCreateRefund({ razorpayPaymentId, amountPaise, notes }) {
    const { keyId, keySecret } = getRazorpayAuth();

    if (!keyId || !keySecret) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay credentials", 500);
    }

    try {
        const resp = await axios.post(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/refund`,
            {
                amount: Number(amountPaise),
                speed: "normal",
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
        throw new AppError("RAZORPAY_REFUND_CREATE_FAILED", msg, status >= 400 && status < 600 ? status : 500);
    }
}

// Decide whether payment retry is allowed for this order or not.
function isRetryAllowedForOrder(order) {
    if (!order) return false;
    if (order.payment_method !== "online") return false;
    if (TERMINAL_ORDER_STATUSES.has(String(order.status || "").toLowerCase())) return false;
    if (TERMINAL_PAYMENT_STATUSES.has(String(order.payment_status || "").toLowerCase())) return false;
    return ONLINE_RETRYABLE_PAYMENT_STATUSES.has(String(order.payment_status || "").toLowerCase());
}

// Convert payment attempt row into a simple API response object.
function toAttemptSummary(attempt) {
    if (!attempt) return null;

    return {
        payment_attempt_id: attempt.id,
        attempt_no: attempt.attempt_no,
        provider: attempt.provider,
        provider_order_id: attempt.provider_order_id,
        provider_payment_id: attempt.provider_payment_id,
        status: attempt.status,
        failure_code: attempt.failure_code,
        failure_reason: attempt.failure_reason,
        amount_paise: attempt.amount_paise,
        currency: attempt.currency,
        created_at: attempt.created_at,
        updated_at: attempt.updated_at,
    };
}

// Build a clean payment status response for order APIs.
function toNormalizedPaymentStatus(order, latestAttempt) {
    const paymentStatus = String(order?.payment_status || "pending");

    return {
        order_id: order.id,
        order_status: order.status,
        payment_status: paymentStatus,
        retry_allowed: !!order.retry_allowed,
        refund_status: order.refund_status || "none",
        verification_pending:
            paymentStatus === "verification_pending" ||
            String(latestAttempt?.status || "") === "verification_pending",
        latest_payment_attempt: toAttemptSummary(latestAttempt),
    };
}

// Get the latest payment attempt for an order.
async function getLatestPaymentAttempt({ orderId, t, lock = false }) {
    return PaymentAttempt.findOne({
        where: { order_id: orderId },
        order: [["attempt_no", "DESC"], ["created_at", "DESC"]],
        transaction: t,
        lock: lock ? t.LOCK.UPDATE : undefined,
    });
}

// Find payment attempt using Razorpay order id or payment id.
async function findAttemptByProviderRefs({ providerOrderId, providerPaymentId, t, lock = false }) {
    let attempt = null;

    if (providerPaymentId) {
        attempt = await PaymentAttempt.findOne({
            where: { provider: "razorpay", provider_payment_id: providerPaymentId },
            transaction: t,
            lock: lock ? t.LOCK.UPDATE : undefined,
        });
    }

    if (!attempt && providerOrderId) {
        attempt = await PaymentAttempt.findOne({
            where: { provider: "razorpay", provider_order_id: providerOrderId },
            transaction: t,
            lock: lock ? t.LOCK.UPDATE : undefined,
        });
    }

    return attempt;
}

// Keep old payments table in sync with new payment attempt data.
async function syncLegacyPaymentRow({ order, attempt, t }) {
    if (!order || !attempt) return null;

    let payment = await Payment.findOne({
        where: {
            order_id: order.id,
            provider: attempt.provider,
            [Op.or]: [
                attempt.provider_order_id ? { provider_order_id: attempt.provider_order_id } : null,
                attempt.provider_payment_id ? { provider_payment_id: attempt.provider_payment_id } : null,
                { id: null },
            ].filter(Boolean),
        },
        order: [["created_at", "DESC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    const payload = {
        order_id: order.id,
        method: order.payment_method,
        status: attempt.status,
        amount_paise: attempt.amount_paise,
        provider: attempt.provider,
        provider_payment_id: attempt.provider_payment_id,
        provider_order_id: attempt.provider_order_id,
        provider_payload: {
            attempt_id: attempt.id,
            verify_response_raw: attempt.verify_response_raw,
            failure_code: attempt.failure_code,
            failure_reason: attempt.failure_reason,
        },
    };

    if (payment) {
        await payment.update(payload, { transaction: t });
        return payment;
    }

    return Payment.create(payload, { transaction: t });
}

// Update order payment-related fields and create status/notification side effects.
async function syncOrderPaymentState({ order, latestAttempt, t, note = null, actorUserId = null, skipStatusEvent = false }) {
    const oldOrderStatus = order.status;
    const oldPaymentStatus = order.payment_status;
    const oldRetryAllowed = !!order.retry_allowed;
    const oldRefundStatus = order.refund_status || "none";

    const nextPaymentStatus = latestAttempt ? latestAttempt.status : oldPaymentStatus;
    let nextOrderStatus = oldOrderStatus;
    let nextRefundStatus = oldRefundStatus;

    if (nextPaymentStatus === "paid" && oldOrderStatus === "payment_pending") {
        nextOrderStatus = "placed";
    }

    if (nextPaymentStatus === "refunded") {
        nextRefundStatus = "refunded";
    } else if (nextPaymentStatus === "refund_pending") {
        nextRefundStatus = "refund_pending";
    } else if (nextPaymentStatus === "refund_failed") {
        nextRefundStatus = "refund_failed";
    } else if (!["refund_pending", "refunded"].includes(nextPaymentStatus)) {
        nextRefundStatus = oldRefundStatus === "refunded" ? "refunded" : oldRefundStatus;
    }

    const nextRetryAllowed = isRetryAllowedForOrder({
        ...order,
        status: nextOrderStatus,
        payment_status: nextPaymentStatus,
    });

    const patch = {};
    if (order.current_payment_attempt_id !== latestAttempt?.id) patch.current_payment_attempt_id = latestAttempt?.id || null;
    if (oldPaymentStatus !== nextPaymentStatus) patch.payment_status = nextPaymentStatus;
    if (oldOrderStatus !== nextOrderStatus) patch.status = nextOrderStatus;
    if (oldRetryAllowed !== nextRetryAllowed) patch.retry_allowed = nextRetryAllowed;
    if (oldRefundStatus !== nextRefundStatus) patch.refund_status = nextRefundStatus;

    if (Object.keys(patch).length > 0) {
        await order.update(patch, { transaction: t });
    }

    if (
        !skipStatusEvent &&
        (oldOrderStatus !== nextOrderStatus || oldPaymentStatus !== nextPaymentStatus || oldRefundStatus !== nextRefundStatus)
    ) {
        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: oldOrderStatus,
                to_status: nextOrderStatus,
                actor_user_id: actorUserId,
                note: note,
                meta: {
                    payment_status_old: oldPaymentStatus,
                    payment_status_new: nextPaymentStatus,
                    refund_status_old: oldRefundStatus,
                    refund_status_new: nextRefundStatus,
                    retry_allowed_old: oldRetryAllowed,
                    retry_allowed_new: nextRetryAllowed,
                    current_payment_attempt_id: latestAttempt?.id || null,
                },
            },
            { transaction: t }
        );
    }

    if (oldOrderStatus === "payment_pending" && nextOrderStatus === "placed") {
        await Notification.create(
            {
                user_id: order.user_id,
                channel: "push",
                template: "order_placed",
                payload: {
                    order_id: order.id,
                    total_paise: order.total_paise,
                    delivery_date: order.delivery_date,
                },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );
    }

    return order;
}

// Create a new payment attempt row for an order.
async function createPaymentAttemptForOrder({ order, t, gatewayOrder = null }) {
    const latest = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });
    const attemptNo = latest ? Number(latest.attempt_no) + 1 : 1;

    const attempt = await PaymentAttempt.create(
        {
            order_id: order.id,
            attempt_no: attemptNo,
            provider: "razorpay",
            provider_order_id: gatewayOrder?.id ? String(gatewayOrder.id) : null,
            provider_payment_id: null,
            provider_signature: null,
            amount_paise: Number(order.total_paise),
            currency: String(gatewayOrder?.currency || "INR"),
            status: gatewayOrder ? "provider_order_created" : "pending",
            failure_code: null,
            failure_reason: null,
            verify_response_raw: gatewayOrder ? { initiation: gatewayOrder } : null,
        },
        { transaction: t }
    );

    await syncLegacyPaymentRow({ order, attempt, t });
    await syncOrderPaymentState({
        order,
        latestAttempt: attempt,
        t,
        note: gatewayOrder ? "payment_attempt_created" : null,
        skipStatusEvent: true,
    });

    return attempt;
}

// Get one order for a specific user.
async function getOrderForUser({ userId, orderId, t, lock = false }) {
    return Order.findOne({
        where: { id: orderId, user_id: userId },
        transaction: t,
        lock: lock ? t.LOCK.UPDATE : undefined,
    });
}

// Get order directly by order id.
async function getOrderById({ orderId, t, lock = false }) {
    return Order.findByPk(orderId, {
        transaction: t,
        lock: lock ? t.LOCK.UPDATE : undefined,
    });
}

// Validate that verify API payload really belongs to this order and attempt.
function assertVerifyAgainstOrder({ order, attempt, payload }) {
    if (!attempt) {
        throw new AppError("PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt not found for this order", 404);
    }

    if (String(attempt.order_id) !== String(order.id)) {
        throw new AppError("PAYMENT_ORDER_MISMATCH", "Payment attempt does not belong to this order", 400);
    }

    if (attempt.provider_order_id && String(attempt.provider_order_id) !== String(payload.razorpay_order_id)) {
        throw new AppError("PROVIDER_ORDER_MISMATCH", "Razorpay order id does not match expected attempt", 400);
    }

    if (Number(attempt.amount_paise) !== Number(order.total_paise)) {
        throw new AppError("PAYMENT_AMOUNT_MISMATCH", "Attempt amount does not match order total", 400);
    }

    if (String(attempt.currency || "INR") !== String(payload.currency || "INR")) {
        throw new AppError("PAYMENT_CURRENCY_MISMATCH", "Attempt currency does not match order currency", 400);
    }
}

// Check if webhook payload looks like a Razorpay webhook format.
function isRazorpayWebhookPayload(payload) {
    return Boolean(payload && payload.payload && (payload.payload.payment || payload.payload.order || payload.payload.refund));
}

// Convert Razorpay webhook payload into one common internal format.
function normalizeRazorpayWebhook(payload) {
    const event = String(payload?.event || "").toLowerCase();
    const eventId = payload?.id ? String(payload.id) : null;
    const paymentEntity = payload?.payload?.payment?.entity || null;
    const orderEntity = payload?.payload?.order?.entity || null;
    const refundEntity = payload?.payload?.refund?.entity || null;
    const notes = paymentEntity?.notes || orderEntity?.notes || refundEntity?.notes || {};

    let status = "pending";
    if (["payment.captured", "order.paid"].includes(event)) status = "paid";
    else if (event === "payment.failed") status = "failed";
    else if (["payment.authorized", "payment.created"].includes(event)) status = "verification_pending";
    else if (["refund.created", "refund.initiated"].includes(event)) status = "refund_pending";
    else if (["refund.processed", "refund.completed"].includes(event)) status = "refunded";
    else if (event === "refund.failed") status = "refund_failed";

    return {
        provider: "razorpay",
        provider_event_id: eventId,
        event,
        status,
        order_id: notes?.fv_order_id || notes?.order_id || null,
        provider_order_id: paymentEntity?.order_id || orderEntity?.id || null,
        provider_payment_id: paymentEntity?.id || refundEntity?.payment_id || null,
        provider_refund_id: refundEntity?.id || null,
        amount_paise: Number(paymentEntity?.amount || refundEntity?.amount || orderEntity?.amount || 0),
        currency: String(paymentEntity?.currency || orderEntity?.currency || refundEntity?.currency || "INR"),
        provider_payload: payload,
    };
}

// Apply provider webhook/update data into order, payment attempt, payment, and refund tables.
async function applyNormalizedProviderUpdate({ normalized, t }) {
    let order = null;
    let attempt = await findAttemptByProviderRefs({
        providerOrderId: normalized.provider_order_id,
        providerPaymentId: normalized.provider_payment_id,
        t,
        lock: true,
    });

    if (!attempt && normalized.order_id) {
        order = await getOrderById({ orderId: normalized.order_id, t, lock: true });
        if (order) {
            attempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });
        }
    }

    if (!attempt && !order && normalized.order_id) {
        order = await getOrderById({ orderId: normalized.order_id, t, lock: true });
    }

    if (!attempt && !order) {
        return { received: true, ignored: true, reason: "payment_attempt_not_found" };
    }

    if (!order) {
        order = await getOrderById({ orderId: attempt.order_id, t, lock: true });
    }

    if (!attempt) {
        attempt = await createPaymentAttemptForOrder({ order, t, gatewayOrder: null });
    }

    if (normalized.status === "paid" && Number(normalized.amount_paise || 0) !== Number(order.total_paise)) {
        throw new AppError("PAYMENT_AMOUNT_MISMATCH", "Provider amount does not match order total", 400);
    }

    const attemptPatch = {
        provider_order_id: normalized.provider_order_id || attempt.provider_order_id,
        provider_payment_id: normalized.provider_payment_id || attempt.provider_payment_id,
        status: normalized.status || attempt.status,
        verify_response_raw: normalized.provider_payload || attempt.verify_response_raw,
    };

    if (normalized.status === "failed") {
        attemptPatch.failure_code = normalized.provider_payload?.payload?.payment?.entity?.error_code || attempt.failure_code || null;
        attemptPatch.failure_reason = normalized.provider_payload?.payload?.payment?.entity?.error_description || attempt.failure_reason || null;
    }

    await attempt.update(attemptPatch, { transaction: t });
    const legacyPayment = await syncLegacyPaymentRow({ order, attempt, t });

    if (
        normalized.provider_event_id &&
        legacyPayment &&
        legacyPayment.provider_event_id !== normalized.provider_event_id
    ) {
        await legacyPayment.update(
            { provider_event_id: normalized.provider_event_id },
            { transaction: t }
        );
    }

    if (normalized.status === "refund_pending" || normalized.status === "refunded" || normalized.status === "refund_failed") {
        const latestLegacyPayment = await Payment.findOne({
            where: { order_id: order.id },
            order: [["created_at", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        let refund = await Refund.findOne({
            where: normalized.provider_refund_id ? { provider_refund_id: normalized.provider_refund_id } : { order_id: order.id },
            order: [["created_at", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        const refundStatus = normalized.status === "refunded" ? "succeeded" : normalized.status === "refund_failed" ? "failed" : "initiated";

        if (refund) {
            await refund.update(
                {
                    payment_id: latestLegacyPayment?.id || refund.payment_id,
                    status: refundStatus,
                    provider_refund_id: normalized.provider_refund_id || refund.provider_refund_id,
                    provider_payload: normalized.provider_payload || refund.provider_payload,
                },
                { transaction: t }
            );
        } else {
            await Refund.create(
                {
                    order_id: order.id,
                    payment_id: latestLegacyPayment?.id || null,
                    status: refundStatus,
                    amount_paise: Number(normalized.amount_paise || order.total_paise || 0),
                    provider_refund_id: normalized.provider_refund_id || null,
                    provider_payload: normalized.provider_payload || null,
                },
                { transaction: t }
            );
        }
    }

    const oldDeliveryDate = order.delivery_date;
    if (normalized.status === "paid" && String(order.status) === "payment_pending" && oldDeliveryDate && getIstYyyyMmDd() >= String(oldDeliveryDate)) {
        await order.update(
            {
                delivery_date: addDays(getIstYyyyMmDd(), 1),
                is_locked: false,
                locked_at: null,
            },
            { transaction: t }
        );
    }

    await syncOrderPaymentState({
        order,
        latestAttempt: attempt,
        t,
        note: normalized.event || "payment_provider_update",
        actorUserId: null,
    });

    return {
        received: true,
        order_id: order.id,
        payment_attempt_id: attempt.id,
        payment_status: order.payment_status,
    };
}

// Get current payment status of one user order.
async function getPaymentStatus({ userId, orderId }) {
    const order = await getOrderForUser({ userId, orderId, t: null, lock: false });
    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    console.log("order : ", order);

    const latestAttempt = await getLatestPaymentAttempt({ orderId: order.id, t: null, lock: false });

    console.log("latestAttempt : ", latestAttempt);
    return toNormalizedPaymentStatus(order, latestAttempt);
}

// Reuse existing pending Razorpay order if possible, otherwise create a new one.
async function createOrReuseGatewayOrderForCurrentOrder({ order, t }) {
    const { keyId } = getRazorpayAuth();
    if (!keyId) {
        throw new AppError("RAZORPAY_NOT_CONFIGURED", "Missing Razorpay key id", 500);
    }

    const latestAttempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });

    if (
        latestAttempt &&
        latestAttempt.provider_order_id &&
        ["provider_order_created", "verification_pending", "pending"].includes(latestAttempt.status)
    ) {
        await syncOrderPaymentState({
            order,
            latestAttempt,
            t,
            skipStatusEvent: true,
        });

        await order.reload({ transaction: t });

        return {
            order_id: order.id,
            order_status: order.status,
            payment_status: order.payment_status,
            retry_allowed: !!order.retry_allowed,
            refund_status: order.refund_status || "none",
            payment_attempt_id: latestAttempt.id,
            razorpay: {
                key_id: keyId,
                razorpay_order_id: latestAttempt.provider_order_id,
                amount_paise: latestAttempt.amount_paise,
                currency: latestAttempt.currency || "INR",
            },
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

    const attempt = await createPaymentAttemptForOrder({ order, t, gatewayOrder });

    await order.reload({ transaction: t });

    return {
        order_id: order.id,
        order_status: order.status,
        payment_status: order.payment_status,
        retry_allowed: !!order.retry_allowed,
        refund_status: order.refund_status || "none",
        payment_attempt_id: attempt.id,
        razorpay: {
            key_id: keyId,
            razorpay_order_id: attempt.provider_order_id,
            amount_paise: attempt.amount_paise,
            currency: attempt.currency,
        },
    };
}

// Create Razorpay order for a user order before opening payment SDK.
async function razorpayCreateOrder({ userId, orderId }) {
    return sequelize.transaction(async (t) => {
        const order = await getOrderForUser({ userId, orderId, t, lock: true });
        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        if (order.payment_method !== "online") {
            throw new AppError("INVALID_PAYMENT_METHOD", "This order is not configured for online payment", 400);
        }

        if (!isRetryAllowedForOrder(order) && String(order.payment_status) !== "provider_order_created") {
            throw new AppError("ORDER_NOT_PAYABLE", `Order is not payable in status: ${order.status}`, 400);
        }

        return createOrReuseGatewayOrderForCurrentOrder({ order, t });
    });
}

// Verify Razorpay success response and mark payment as paid.
async function razorpayVerifyPayment({ userId, payload }) {
    const { keySecret } = getRazorpayAuth();
    const signatureOk = verifyRazorpayCheckoutSignature({
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature,
        keySecret,
    });

    if (!signatureOk) {
        throw new AppError("INVALID_SIGNATURE", "Invalid Razorpay signature", 401);
    }

    return sequelize.transaction(async (t) => {
        const order = await getOrderForUser({ userId, orderId: payload.order_id, t, lock: true });
        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        let attempt = await findAttemptByProviderRefs({
            providerOrderId: payload.razorpay_order_id,
            providerPaymentId: payload.razorpay_payment_id,
            t,
            lock: true,
        });

        if (!attempt && order.current_payment_attempt_id) {
            attempt = await PaymentAttempt.findByPk(order.current_payment_attempt_id, {
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        if (String(order.payment_status || "") === "paid") {
            const latestAttempt = attempt || (await getLatestPaymentAttempt({ orderId: order.id, t, lock: false }));
            return {
                verified: true,
                idempotent: true,
                ...toNormalizedPaymentStatus(order, latestAttempt),
                payment_attempt_id: latestAttempt?.id || null,
            };
        }

        assertVerifyAgainstOrder({ order, attempt, payload });

        await attempt.update(
            {
                provider_payment_id: payload.razorpay_payment_id,
                provider_signature: payload.razorpay_signature,
                status: "paid",
                failure_code: null,
                failure_reason: null,
                verify_response_raw: {
                    verified: true,
                    razorpay_order_id: payload.razorpay_order_id,
                    razorpay_payment_id: payload.razorpay_payment_id,
                    razorpay_signature: payload.razorpay_signature,
                    source: "verify_api",
                },
            },
            { transaction: t }
        );

        await syncLegacyPaymentRow({ order, attempt, t });
        await syncOrderPaymentState({
            order,
            latestAttempt: attempt,
            t,
            note: "payment_verify_success",
            actorUserId: userId,
        });

        const refreshedOrder = await getOrderById({ orderId: order.id, t, lock: false });
        return {
            verified: true,
            ...toNormalizedPaymentStatus(refreshedOrder, attempt),
            payment_attempt_id: attempt.id,
        };
    });
}

// Retry payment for an order if retry is allowed.
async function retryPayment({ userId, orderId }) {
    return sequelize.transaction(async (t) => {
        const order = await getOrderForUser({ userId, orderId, t, lock: true });
        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        const latestAttempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });
        const allowed = isRetryAllowedForOrder(order);

        if (!allowed) {
            return {
                allowed: false,
                reason: "retry_not_allowed",
                ...toNormalizedPaymentStatus(order, latestAttempt),
            };
        }

        const result = await createOrReuseGatewayOrderForCurrentOrder({ order, t });
        return {
            allowed: true,
            ...result,
        };
    });
}

// Mark payment as verification pending when SDK/webhook result is still not final.
async function reconcilePayment({ userId, orderId }) {
    return sequelize.transaction(async (t) => {
        const order = await getOrderForUser({ userId, orderId, t, lock: true });
        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        const latestAttempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });

        if (
            latestAttempt &&
            latestAttempt.provider_payment_id &&
            !["paid", "failed", "refunded", "refund_pending", "refund_failed"].includes(String(latestAttempt.status))
        ) {
            await latestAttempt.update(
                {
                    status: "verification_pending",
                    verify_response_raw: {
                        ...(latestAttempt.verify_response_raw || {}),
                        reconcile_marked_at: new Date().toISOString(),
                        source: "reconcile_api",
                    },
                },
                { transaction: t }
            );
            await syncLegacyPaymentRow({ order, attempt: latestAttempt, t });
            await syncOrderPaymentState({
                order,
                latestAttempt,
                t,
                note: "payment_reconcile_marked_verification_pending",
                actorUserId: userId,
                skipStatusEvent: true,
            });
        }

        const refreshedOrder = await getOrderById({ orderId: order.id, t, lock: false });
        const refreshedAttempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: false });
        return toNormalizedPaymentStatus(refreshedOrder, refreshedAttempt);
    });
}

// Admin starts refund flow for a cancelled and paid order.
async function adminInitiateRefund({ actorUserId, orderId, reason }) {
    return sequelize.transaction(async (t) => {
        const order = await getOrderById({ orderId, t, lock: true });
        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        if (String(order.status) !== "cancelled") {
            throw new AppError("REFUND_NOT_ALLOWED", "Refund is allowed only for cancelled orders", 400);
        }
        if (String(order.payment_status) !== "paid") {
            throw new AppError("REFUND_NOT_ALLOWED", "Refund is allowed only for paid orders", 400);
        }
        if (String(order.refund_status || "none") === "refund_pending" || String(order.refund_status || "none") === "refunded") {
            throw new AppError("REFUND_ALREADY_EXISTS", "Refund already initiated for this order", 400);
        }

        const latestAttempt = await getLatestPaymentAttempt({ orderId: order.id, t, lock: true });
        if (!latestAttempt?.provider_payment_id) {
            throw new AppError("REFUND_NOT_ALLOWED", "Provider payment id is missing for this order", 400);
        }

        const existingRefund = await Refund.findOne({
            where: {
                order_id: order.id,
                status: { [Op.in]: ["initiated", "succeeded"] },
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (existingRefund) {
            throw new AppError("REFUND_ALREADY_EXISTS", "Refund already exists for this order", 400);
        }

        const legacyPayment = await Payment.findOne({
            where: { order_id: order.id },
            order: [["created_at", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        const refundRow = await Refund.create(
            {
                order_id: order.id,
                payment_id: legacyPayment?.id || null,
                status: "initiated",
                amount_paise: order.total_paise,
                provider_refund_id: null,
                provider_payload: null,
            },
            { transaction: t }
        );

        await latestAttempt.update(
            {
                status: "refund_pending",
                verify_response_raw: {
                    ...(latestAttempt.verify_response_raw || {}),
                    refund_requested_by: actorUserId,
                    refund_reason: reason || null,
                    refund_requested_at: new Date().toISOString(),
                },
            },
            { transaction: t }
        );
        await syncLegacyPaymentRow({ order, attempt: latestAttempt, t });
        await syncOrderPaymentState({
            order,
            latestAttempt,
            t,
            note: "admin_refund_initiated",
            actorUserId,
        });

        const refundResp = await razorpayCreateRefund({
            razorpayPaymentId: latestAttempt.provider_payment_id,
            amountPaise: order.total_paise,
            notes: {
                fv_order_id: String(order.id),
                fv_order_number: String(order.order_number || ""),
                refund_reason: reason || undefined,
                initiated_by: String(actorUserId || "system"),
            },
        });

        await refundRow.update(
            {
                provider_refund_id: refundResp?.id || null,
                provider_payload: refundResp,
                status: String(refundResp?.status || "").toLowerCase() === "processed" ? "succeeded" : "initiated",
            },
            { transaction: t }
        );

        if (String(refundResp?.status || "").toLowerCase() === "processed") {
            await latestAttempt.update(
                {
                    status: "refunded",
                    verify_response_raw: {
                        ...(latestAttempt.verify_response_raw || {}),
                        refund_response: refundResp,
                    },
                },
                { transaction: t }
            );
            await syncLegacyPaymentRow({ order, attempt: latestAttempt, t });
            await syncOrderPaymentState({
                order,
                latestAttempt,
                t,
                note: "admin_refund_processed",
                actorUserId,
            });
        }

        const refreshedOrder = await getOrderById({ orderId: order.id, t, lock: false });
        return {
            refund_id: refundRow.id,
            provider_refund_id: refundRow.provider_refund_id,
            refund_status: refreshedOrder.refund_status,
            order_id: refreshedOrder.id,
            order_status: refreshedOrder.status,
            payment_status: refreshedOrder.payment_status,
            payment_attempt_id: latestAttempt.id,
        };
    });
}

// Return full payment, attempt, and refund history for admin audit screen.
async function adminGetPaymentAudit({ orderId }) {
    const order = await Order.findByPk(orderId, {
        include: [
            {
                model: PaymentAttempt,
                as: "payment_attempts",
                required: false,
                separate: true,
                order: [["attempt_no", "DESC"]],
            },
            {
                model: Refund,
                as: "refunds",
                required: false,
                separate: true,
                order: [["created_at", "DESC"]],
            },
            {
                model: Payment,
                as: "payments",
                required: false,
                separate: true,
                order: [["created_at", "DESC"]],
            },
        ],
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const latestAttempt = order.payment_attempts?.[0] || null;
    return {
        order_id: order.id,
        order_status: order.status,
        payment_status: order.payment_status,
        retry_allowed: !!order.retry_allowed,
        refund_status: order.refund_status || "none",
        current_payment_attempt_id: order.current_payment_attempt_id || latestAttempt?.id || null,
        latest_payment_attempt: latestAttempt,
        payment_attempts: order.payment_attempts || [],
        refunds: order.refunds || [],
        legacy_payments: order.payments || [],
    };
}

// Main webhook handler to verify signature and process provider event safely.
async function handleWebhook({ headers, payload, rawBody }) {
    const webhookSecret =
        String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim() ||
        String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim() ||
        null;

    if (!webhookSecret) {
        throw new AppError(
            "WEBHOOK_NOT_CONFIGURED",
            "Payment webhook secret is not configured",
            500
        );
    }

    const signature =
        headers["x-razorpay-signature"] ||
        headers["x-webhook-signature"] ||
        headers["x-signature"] ||
        null;

    const ok = verifyWebhookSignature({ rawBody, signature, secret: webhookSecret });
    if (!ok) {
        throw new AppError("INVALID_WEBHOOK_SIGNATURE", "Invalid payment webhook signature", 401);
    }

    const normalized = isRazorpayWebhookPayload(payload)
        ? normalizeRazorpayWebhook(payload)
        : {
            provider: payload.provider || "gateway",
            provider_event_id: payload.provider_event_id || payload.event_id || null,
            event: payload.event || null,
            status: String(payload.status || "pending").toLowerCase(),
            order_id: payload.order_id || null,
            provider_order_id: payload.provider_order_id || null,
            provider_payment_id: payload.provider_payment_id || payload.payment_id || null,
            provider_refund_id: payload.provider_refund_id || null,
            amount_paise: Number(payload.amount_paise || 0),
            currency: String(payload.currency || "INR"),
            provider_payload: payload,
        };

    return sequelize.transaction(async (t) => {
        if (normalized.provider_event_id) {
            const existingPayment = await Payment.findOne({
                where: {
                    provider: normalized.provider,
                    provider_event_id: normalized.provider_event_id,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (existingPayment) {
                const order = await getOrderById({
                    orderId: existingPayment.order_id,
                    t,
                    lock: false,
                });

                const latestAttempt = order
                    ? await getLatestPaymentAttempt({
                        orderId: order.id,
                        t,
                        lock: false,
                    })
                    : null;

                return {
                    received: true,
                    idempotent: true,
                    order_id: existingPayment.order_id,
                    payment_status: order?.payment_status || existingPayment.status,
                    latest_payment_attempt: latestAttempt
                        ? toAttemptSummary(latestAttempt)
                        : null,
                };
            }
        }

        return applyNormalizedProviderUpdate({ normalized, t });
    });
}

module.exports = {
    handleWebhook,
    razorpayCreateOrder,
    razorpayVerifyPayment,
    getPaymentStatus,
    retryPayment,
    reconcilePayment,
    adminInitiateRefund,
    adminGetPaymentAudit,
    toNormalizedPaymentStatus,
    getLatestPaymentAttempt,
    syncOrderPaymentState,
    createOrReuseGatewayOrderForCurrentOrder,
    razorpayCreateRefund,
};