"use strict";

const { Op } = require("sequelize");
const {
    sequelize,
    Order,
    User,
    UserAddress,
    Warehouse,
    OrderStatusEvent,
    Notification,
} = require("../../models");
const { AppError } = require("../../utils/errors");

// ✅ Updated transitions with locked
const ALLOWED_TRANSITIONS = {
    payment_pending: ["placed", "cancelled"],
    placed: ["locked", "accepted", "cancelled"],
    confirmed: ["locked", "accepted", "cancelled"],

    locked: ["accepted", "cancelled"],

    accepted: ["packed", "cancelled"],
    packed: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["delivered"],

    delivered: [],
    cancelled: [],
    refunded: [],
};

function assertTransition(fromStatus, toStatus) {
    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
        throw new AppError(
            "INVALID_STATUS_TRANSITION",
            `Cannot change status from ${fromStatus} to ${toStatus}`,
            400
        );
    }
}

async function list({ actorUserId, query }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const where = {};

    if (query.status) {
        where.status = query.status;
    }
    if (query.warehouse_id) {
        where.warehouse_id = query.warehouse_id;
    }
    if (query.delivery_date) {
        where.delivery_date = query.delivery_date;
    }

    if (query.q) {
        where[Op.or] = [{ id: { [Op.iLike]: `${query.q}%` } }];
    }

    const { rows, count } = await Order.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: "warehouse", required: false },
            { model: User, as: "user", required: false, attributes: ["id", "phone", "full_name"] },
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

async function updateStatus({ actorUserId, orderId, to_status, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        // ✅ IMPORTANT CHANGE:
        // is_locked should NOT block ops transitions.
        // is_locked should block customer modifications/cancel only.

        const fromStatus = order.status;
        if (fromStatus === to_status) {
            return { order: { id: order.id, status: order.status } };
        }

        assertTransition(fromStatus, to_status);

        await order.update(
            {
                status: to_status,
                // ✅ Do NOT modify is_locked here. Scheduler sets it at midnight.
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: fromStatus,
                to_status,
                actor_user_id: actorUserId,
                note: note || null,
                meta: { source: "ops" },
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: order.user_id,
                channel: "push",
                template: "order_status_changed",
                payload: { order_id: order.id, from_status: fromStatus, to_status },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return { order: { id: order.id, status: order.status, is_locked: order.is_locked } };
    });
}

module.exports = {
    list,
    updateStatus,
};
