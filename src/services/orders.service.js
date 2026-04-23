"use strict";

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
} = require("../models");
const { AppError } = require("../utils/errors");
const PaymentsService = require("../services/payments.service");
// const InventoryService = require("../services/inventory.service");

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

function mergePaymentSnapshot(orderJson, paymentStatus) {
    if (!orderJson) return orderJson;
    return {
        ...orderJson,
        payment_status: paymentStatus.payment_status,
        retry_allowed: paymentStatus.retry_allowed,
        refund_status: paymentStatus.refund_status,
        verification_pending: paymentStatus.verification_pending,
        latest_payment_attempt: paymentStatus.latest_payment_attempt,
    };
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

    const withPayment = await Promise.all(
        jsonOrders.map(async (order) => {
            const paymentStatus = await PaymentsService.getPaymentStatus({ userId, orderId: order.id });
            return mergePaymentSnapshot(order, paymentStatus);
        })
    );

    return { orders: withPayment, page, limit, total: count };
}

async function getMyOrderById({ userId, orderId }) {
    const order = await Order.findOne({
        where: { id: orderId, user_id: userId },
        include: [
            { model: Warehouse, as: "warehouse", required: false },
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

    const paymentStatus = await PaymentsService.getPaymentStatus({ userId, orderId: order.id });

    return { order: mergePaymentSnapshot(json, paymentStatus) };
}

async function cancelMyOrder({ userId, orderId, reason }) {
    const cancelled = await sequelize.transaction(async (t) => {
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

        const fromStatus = order.status;
        const shouldAutoRefund =
            order.payment_method === "online" &&
            String(order.payment_status) === "paid";

        await order.update(
            {
                status: "cancelled",
                is_locked: false,
                cancelled_at: new Date(),
                cancellation_reason: reason || null,
                retry_allowed: false,
            },
            { transaction: t }
        );

        // await InventoryService.releaseReservedInventoryForOrder({
        //     orderId: order.id,
        //     t,
        // });

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: fromStatus,
                to_status: "cancelled",
                actor_user_id: userId,
                note: reason || null,
                meta: {
                    source: "customer",
                    payment_status: order.payment_status,
                    refund_status: order.refund_status || "none",
                    auto_refund_requested: shouldAutoRefund,
                },
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: userId,
                channel: "push",
                template: "order_cancelled",
                payload: {
                    order_id: order.id,
                    refund_status: order.refund_status || "none",
                    auto_refund_requested: shouldAutoRefund,
                },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return {
            orderId: order.id,
            shouldAutoRefund,
        };
    });

    let refund = null;

    if (cancelled.shouldAutoRefund) {
        try {
            refund = await PaymentsService.adminInitiateRefund({
                actorUserId: userId,
                orderId: cancelled.orderId,
                reason: reason || "customer_cancelled_order",
            });
        } catch (e) {
            refund = {
                initiated: false,
                error_code: e.code || "REFUND_INITIATION_FAILED",
                message: e.message || "Refund initiation failed",
            };
        }
    }

    const paymentStatus = await PaymentsService.getPaymentStatus({
        userId,
        orderId: cancelled.orderId,
    });

    return {
        order: {
            id: cancelled.orderId,
            status: "cancelled",
            payment_status: paymentStatus.payment_status,
            refund_status: paymentStatus.refund_status,
            retry_allowed: paymentStatus.retry_allowed,
        },
        refund,
    };
}

module.exports = {
    listMyOrders,
    getMyOrderById,
    cancelMyOrder,
};
