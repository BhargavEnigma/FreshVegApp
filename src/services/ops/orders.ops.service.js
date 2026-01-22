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
    OrderItem,
    Product,
    ProductImage,
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

function csvEscape(value) {
    const s = value == null ? "" : String(value);
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

function money(paise) {
    return (Number(paise || 0) / 100).toFixed(2);
}

async function exportCsv({ actorUserId, query }) {
    // Reuse same where-building logic you use in list()
    // IMPORTANT: keep it lightweight (no items include)
    const where = {};
    if (query.status) where.status = query.status;
    if (query.warehouse_id) where.warehouse_id = query.warehouse_id;
    if (query.delivery_date) where.delivery_date = query.delivery_date;

    const orders = await Order.findAll({
        where,
        include: [
            { model: Warehouse, as: "warehouse", required: false, attributes: ["id", "name"] },
            { model: User, as: "user", required: false, attributes: ["id", "phone", "full_name"] },
        ],
        order: [["created_at", "DESC"]],
    });

    const headers = [
        "order_number",
        "order_id",
        "status",
        "delivery_date",
        "warehouse",
        "customer_name",
        "customer_phone",
        "subtotal",
        "delivery_fee",
        "discount",
        "gst_amount",
        "total",
        "payment_method",
        "payment_status",
        "is_locked",
        "created_at",
    ];

    const rows = orders.map((o) => {
        const x = o.toJSON();
        return [
            x.order_number || "",
            x.id || "",
            x.status || "",
            x.delivery_date || "",
            x.warehouse?.name || "",
            x.user?.full_name || "",
            x.user?.phone || "",
            money(x.subtotal_paise),
            money(x.delivery_fee_paise),
            money(x.discount_paise),
            money(x.gst_amount_paise),
            money(x.total_paise),
            x.payment_method || "",
            x.payment_status || "",
            x.is_locked ? "true" : "false",
            x.created_at || "",
        ];
    });

    const csv = [
        headers.map(csvEscape).join(","),
        ...rows.map((r) => r.map(csvEscape).join(",")),
    ].join("\n");

    const tag = query.delivery_date ? `date-${query.delivery_date}` : "all";
    const filename = `ops_orders_${tag}_${new Date().toISOString().slice(0, 10)}.csv`;

    return { csv, filename };
}

async function getById({ actorUserId, orderId }) {
    const order = await Order.findByPk(orderId, {
        include: [
            { model: Warehouse, as: "warehouse", required: false },
            { model: User, as: "user", required: false, attributes: ["id", "phone", "full_name"] },
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
        ],
        order: [[{ model: OrderItem, as: "items" }, "created_at", "ASC"]],
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const json = order.toJSON();
    // sort images consistently (same logic as list)
    if (Array.isArray(json.items)) {
        for (const it of json.items) {
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

    return { order: json };
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
    getById,
    exportCsv,
    updateStatus,
};
