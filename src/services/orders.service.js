"use strict";

const { Op } = require("sequelize");
const {
    sequelize,
    Order,
    OrderItem,
    Product,
    ProductImage,
    UserAddress,
    Warehouse,
    OrderStatusEvent,
    Notification,
    Refund,
    Payment,
} = require("../models");
const { AppError } = require("../utils/errors");
const PaymentsService = require("../services/payments.service");

const CANCEL_ALLOWED_STATUSES = new Set(["payment_pending", "placed"]);

function getIstYyyyMmDd(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    return `${y}-${m}-${d}`;
}

function isCustomerCancellationWindowOpen(order) {
    if (!order?.delivery_date) return false;
    return getIstYyyyMmDd() < String(order.delivery_date);
}

function sortProductImagesInOrderJson(orderJson) {
    if (!orderJson) return orderJson;

    const normalizeOneOrder = (o) => {
        if (Array.isArray(o.items)) {
            for (const it of o.items) {
                if (it?.product?.images && Array.isArray(it.product.images)) {
                    it.product.images.sort((a, b) => {
                        const soA = a.sort_order ?? 0;
                        const soB = b.sort_order ?? 0;
                        if (soA !== soB) return soA - soB;
                        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
                    });
                }
            }
        }
    };

    if (Array.isArray(orderJson)) {
        for (const o of orderJson) normalizeOneOrder(o);
        return orderJson;
    }

    normalizeOneOrder(orderJson);
    return orderJson;
}

function buildAddressSnapshot(orderLike) {
    if (!orderLike) return null;

    const hasSnapshot =
        orderLike.delivery_address_line1 ||
        orderLike.delivery_pincode ||
        orderLike.delivery_city ||
        orderLike.delivery_state;

    if (!hasSnapshot) return null;

    return {
        id: orderLike.address_id || null,
        label: orderLike.delivery_label ?? null,
        name: orderLike.delivery_name ?? null,
        phone: orderLike.delivery_phone ?? null,
        address_line1: orderLike.delivery_address_line1 ?? null,
        address_line2: orderLike.delivery_address_line2 ?? null,
        landmark: orderLike.delivery_landmark ?? null,
        area: orderLike.delivery_area ?? null,
        city: orderLike.delivery_city ?? null,
        state: orderLike.delivery_state ?? null,
        pincode: orderLike.delivery_pincode ?? null,
        lat: orderLike.delivery_lat ?? null,
        lng: orderLike.delivery_lng ?? null,
    };
}

function attachAddressFallback(orderJson) {
    if (!orderJson) return orderJson;

    const applyOne = (o) => {
        if (!o.address) {
            o.address = buildAddressSnapshot(o);
        }
        return o;
    };

    if (Array.isArray(orderJson)) {
        return orderJson.map(applyOne);
    }

    return applyOne(orderJson);
}

async function listMyOrders({ userId, query }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const where = { user_id: userId };

    if (query.status) where.status = query.status;

    const { rows, count } = await Order.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: "warehouse", attributes: ["id", "name", "city", "state"], required: false },
            // { model: UserAddress, as: "address", required: false },
            {
                model: OrderItem,
                as: "items",
                required: false,
                include: [
                    {
                        model: Product,
                        as: "product",
                        required: false,
                        include: [{ model: ProductImage, as: "images", required: false }],
                    },
                ],
            },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
    });

    let jsonOrders = rows.map((r) => r.toJSON());
    jsonOrders = attachAddressFallback(jsonOrders);
    sortProductImagesInOrderJson(jsonOrders);

    return { orders: jsonOrders, page, limit, total: count };
}

async function getMyOrderById({ userId, orderId }) {
    const order = await Order.findOne({
        where: { id: orderId, user_id: userId },
        include: [
            { model: Warehouse, as: "warehouse", required: false },
            // { model: UserAddress, as: "address", required: false },
            {
                model: OrderItem,
                as: "items",
                required: false,
                include: [
                    {
                        model: Product,
                        as: "product",
                        required: false,
                        include: [{ model: ProductImage, as: "images", required: false }],
                    },
                ],
            },
            {
                model: OrderStatusEvent,
                as: "status_events",
                required: false,
            },
        ],
        order: [[{ model: OrderStatusEvent, as: "status_events" }, "created_at", "ASC"]],
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    let json = order.toJSON();
    json = attachAddressFallback(json);
    sortProductImagesInOrderJson(json);

    return { order: json };
}

async function cancelMyOrder({ userId, orderId, reason }) {
    let payment = null;
    let refundRowId = null;
    let orderSnapshot = null;

    await sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { id: orderId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        if (order.is_locked || !isCustomerCancellationWindowOpen(order)) {
            throw new AppError("ORDER_LOCKED", "Order cannot be modified after the IST cutoff", 400);
        }

        if (!CANCEL_ALLOWED_STATUSES.has(order.status)) {
            throw new AppError("CANNOT_CANCEL", "Order cannot be cancelled at this stage", 400);
        }

        orderSnapshot = {
            id: order.id,
            status: order.status,
            user_id: order.user_id,
            order_number: order.order_number,
            total_paise: order.total_paise,
            payment_method: order.payment_method,
            payment_status: order.payment_status,
        };

        if (order.payment_method === "online" && order.payment_status === "paid") {
            payment = await Payment.findOne({
                where: { order_id: order.id, provider: "razorpay" },
                order: [["created_at", "DESC"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const razorpayPaymentId = payment?.provider_payment_id;
            if (!razorpayPaymentId) {
                throw new AppError(
                    "REFUND_NOT_POSSIBLE",
                    "Paid order cannot be cancelled because Razorpay payment id is missing",
                    400
                );
            }

            const refundRow = await Refund.create(
                {
                    order_id: order.id,
                    payment_id: payment.id,
                    status: "initiated",
                    amount_paise: order.total_paise,
                    provider_refund_id: null,
                    provider_payload: null,
                },
                { transaction: t }
            );

            refundRowId = refundRow.id;
        }
    });

    let refundInfo = null;

    if (orderSnapshot.payment_method === "online" && orderSnapshot.payment_status === "paid") {
        const refundResp = await PaymentsService.razorpayCreateRefund({
            razorpayPaymentId: payment.provider_payment_id,
            amountPaise: orderSnapshot.total_paise,
            notes: {
                fv_order_id: String(orderSnapshot.id),
                fv_order_number: String(orderSnapshot.order_number || ""),
                reason: reason || undefined,
            },
        });

        refundInfo = {
            id: refundRowId,
            provider_refund_id: refundResp?.id || null,
            status: String(refundResp?.status || "initiated"),
        };

        await Refund.update(
            {
                provider_refund_id: refundInfo.provider_refund_id,
                provider_payload: refundResp,
                status: refundInfo.status === "processed" ? "succeeded" : "initiated",
            },
            { where: { id: refundRowId } }
        );
    }

    await sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { id: orderSnapshot.id, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        const fromStatus = order.status;

        await order.update(
            {
                status: "cancelled",
                is_locked: false,
                cancelled_at: new Date(),
                cancellation_reason: reason || null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: fromStatus,
                to_status: "cancelled",
                actor_user_id: userId,
                note: reason || null,
                meta: { source: "customer", refund: refundInfo },
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: userId,
                channel: "push",
                template: "order_cancelled",
                payload: { order_id: order.id, refund: refundInfo },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );
    });

    return { order: { id: orderSnapshot.id, status: "cancelled" }, refund: refundInfo };
}

module.exports = {
    listMyOrders,
    getMyOrderById,
    cancelMyOrder,
};