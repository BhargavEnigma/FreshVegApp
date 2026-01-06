"use strict";

const { Op } = require("sequelize");
const {
    sequelize,
    Order,
    OrderItem,
    UserAddress,
    Warehouse,
    OrderStatusEvent,
    Notification,
} = require("../models");
const { AppError } = require("../utils/errors");

const CANCEL_ALLOWED_STATUSES = new Set(["payment_pending", "placed"]);

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
            { model: Warehouse, as: "warehouse", required: false },
            { model: UserAddress, as: "address", required: false },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
    });

    return {
        orders: rows,
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
            { model: OrderItem, as: "items", required: false },
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

    return { order };
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

        await order.update(
            {
                status: "cancelled",
                payment_status: order.payment_method === "cod" ? order.payment_status : "pending",
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
                meta: { source: "customer" },
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: userId,
                channel: "push",
                template: "order_cancelled",
                payload: { order_id: order.id },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return { order: { id: order.id, status: order.status } };
    });
}

module.exports = {
    listMyOrders,
    getMyOrderById,
    cancelMyOrder,
};
