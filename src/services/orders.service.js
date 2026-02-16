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

async function listMyOrders({ userId, query }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where = { user_id: userId };

    if (query.status) {
        where.status = query.status;
    }

    const { rows, count } = await Order.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: "warehouse", attributes: ["id", "name", "city", "state"], required: false },
            { model: UserAddress, as: "address", required: false },

            // ✅ ADDED: include items + product details for each order in list
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

    // ✅ Ensure deterministic image ordering for UI (same idea as getMyOrderById)
    const jsonOrders = rows.map((r) => r.toJSON());
    sortProductImagesInOrderJson(jsonOrders);

    return {
        orders: jsonOrders,
        page,
        limit,
        total: count,
    };
}

async function getMyOrderById({ userId, orderId }) {
    const order = await Order.findOne({
        where: { id: orderId, user_id: userId },
        include: [
            { model: Warehouse, as: "warehouse", required: false },
            { model: UserAddress, as: "address", required: false },
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
                order: [["created_at", "ASC"]],
            },
        ],
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    // Ensure deterministic image ordering for UI
    const json = order.toJSON();
    sortProductImagesInOrderJson(json);

    return { order: json };
}

async function cancelMyOrder({ userId, orderId, reason }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { id: orderId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        if (order.is_locked) {
            throw new AppError("ORDER_LOCKED", "Order cannot be modified", 400);
        }

        if (!CANCEL_ALLOWED_STATUSES.has(order.status)) {
            throw new AppError("CANNOT_CANCEL", "Order cannot be cancelled at this stage", 400);
        }

        const fromStatus = order.status;

        // ✅ If UPI already paid, initiate refund (do not lie by setting payment_status back to pending)
        let refundInfo = null;

        if (order.payment_method === "online" && order.payment_status === "paid") {
            const payment = await Payment.findOne({
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

            // Create refund row (initiated)
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

            const refundResp = await PaymentsService.razorpayCreateRefund({
                razorpayPaymentId,
                amountPaise: order.total_paise,
                notes: {
                    fv_order_id: String(order.id),
                    fv_order_number: String(order.order_number || ""),
                    reason: reason || undefined,
                },
            });

            refundInfo = {
                id: refundRow.id,
                provider_refund_id: refundResp?.id || null,
                status: String(refundResp?.status || "initiated"),
            };

            await refundRow.update(
                {
                    provider_refund_id: refundInfo.provider_refund_id,
                    provider_payload: refundResp,
                    // If Razorpay immediately returns processed, mark succeeded
                    status: refundInfo.status === "processed" ? "succeeded" : "initiated",
                },
                { transaction: t }
            );
        }

        await order.update(
            {
                status: "cancelled",
                cancelled_at: new Date(),
                cancellation_reason: reason || null,
                // ✅ Do NOT downgrade payment_status. Leave it as-is.
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

        return { order: { id: order.id, status: order.status }, refund: refundInfo };
    });
}

module.exports = {
    listMyOrders,
    getMyOrderById,
    cancelMyOrder,
};
