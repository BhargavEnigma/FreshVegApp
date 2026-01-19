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

function sortProductImagesInOrdersJson(ordersJson) {
    if (!Array.isArray(ordersJson)) return ordersJson;

    for (const o of ordersJson) {
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
    }

    return ordersJson;
}

async function deliveryTodayOrderList({ actorUserId, query }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const where = {};

    where.status = 'locked';
    if (query.warehouse_id) {
        where.warehouse_id = query.warehouse_id;
    }
    where.delivery_date = new Date().toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });

    console.log('WHERE : ', where);

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
            // ✅ ADDED: include items + product details for ops/admin list view
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

    const jsonOrders = rows.map((r) => r.toJSON());
    sortProductImagesInOrdersJson(jsonOrders);

    return {
        orders: jsonOrders,
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
    deliveryTodayOrderList,
    updateStatus,
};
