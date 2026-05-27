"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");

const {
    sequelize,
    Order,
    OrderItem,
    Product,
    ProductImage,
    Warehouse,
    User,
    UserRole,
    UserWarehouseAssignment,
    OrderStatusEvent,
    Notification,
} = require("../../models");
const { AppError } = require("../../utils/errors");

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

function hashOtp(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sortProductImagesInOrderJson(orderJson) {
    if (!orderJson) return orderJson;

    const normalizeOne = (o) => {
        if (!Array.isArray(o.items)) return;

        for (const item of o.items) {
            if (item?.product?.images && Array.isArray(item.product.images)) {
                item.product.images.sort((a, b) => {
                    const soA = a.sort_order ?? 0;
                    const soB = b.sort_order ?? 0;
                    if (soA !== soB) return soA - soB;
                    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
                });
            }
        }
    };

    if (Array.isArray(orderJson)) {
        for (const o of orderJson) normalizeOne(o);
        return orderJson;
    }

    normalizeOne(orderJson);
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

async function getActorWarehouseScope(actorUserId) {
    const rolesRows = await UserRole.findAll({
        where: { user_id: actorUserId },
        attributes: ["role"],
    });

    const roles = rolesRows.map((r) => r.role);

    const assignments = await UserWarehouseAssignment.findAll({
        where: { user_id: actorUserId },
        attributes: ["warehouse_id"],
    });

    return {
        roles,
        warehouseIds: assignments.map((x) => x.warehouse_id),
    };
}

async function assertAssignedOrderAccess({ actorUserId, order }) {
    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    if (String(order.delivery_partner_user_id || "") !== String(actorUserId)) {
        throw new AppError("FORBIDDEN", "This order is not assigned to you", 403);
    }

    const scope = await getActorWarehouseScope(actorUserId);
    if (!scope.warehouseIds.length) {
        throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
    }

    if (!scope.warehouseIds.includes(order.warehouse_id)) {
        throw new AppError("FORBIDDEN", "You cannot access another warehouse order", 403);
    }
}

async function createNotification({ userId, template, payload, transaction }) {
    await Notification.create(
        {
            user_id: userId,
            channel: "push",
            template,
            payload,
            status: "queued",
            attempt_count: 0,
            scheduled_at: null,
        },
        { transaction }
    );
}

async function getAssignedOrderInclude({ withEvents = false } = {}) {
    const include = [
        {
            model: Warehouse,
            as: "warehouse",
            required: false,
            attributes: ["id", "name", "city", "state"],
        },
        {
            model: User,
            as: "user",
            required: false,
            attributes: ["id", "full_name", "phone"],
        },
        {
            model: User,
            as: "delivery_partner",
            required: false,
            attributes: ["id", "full_name", "phone"],
        },
        {
            model: OrderItem,
            as: "items",
            required: false,
            include: [
                {
                    model: Product,
                    as: "product",
                    required: false,
                    include: [
                        {
                            model: ProductImage,
                            as: "images",
                            required: false,
                        },
                    ],
                },
            ],
        },
    ];

    if (withEvents) {
        include.push({
            model: OrderStatusEvent,
            as: "status_events",
            required: false,
        });
    }

    return include;
}

async function listAssignedOrders({ actorUserId, query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;

    const scope = await getActorWarehouseScope(actorUserId);
    if (!scope.warehouseIds.length) {
        throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
    }

    const where = {
        delivery_partner_user_id: actorUserId,
        warehouse_id: { [Op.in]: scope.warehouseIds },
        status: query.status || { [Op.notIn]: ["cancelled", "refunded", "delivered"] },
    };

    if (query.delivery_date) {
        where.delivery_date = query.delivery_date;
    }

    if (query.q) {
        where[Op.or] = [
            { order_number: { [Op.iLike]: `%${query.q}%` } },
            { delivery_name: { [Op.iLike]: `%${query.q}%` } },
            { delivery_phone: { [Op.iLike]: `%${query.q}%` } },
        ];
    }

    const { rows, count } = await Order.findAndCountAll({
        where,
        include: await getAssignedOrderInclude(),
        order: [
            ["delivery_date", "ASC"],
            ["created_at", "DESC"],
        ],
        limit,
        offset,
        distinct: true,
    });

    let orders = rows.map((x) => x.toJSON());
    orders = attachAddressFallback(orders);
    sortProductImagesInOrderJson(orders);

    return {
        orders,
        page,
        limit,
        total: Number(count || 0),
    };
}

async function listTodayOrders({ actorUserId, query }) {
    return listAssignedOrders({
        actorUserId,
        query: {
            ...query,
            delivery_date: getIstYyyyMmDd(),
        },
    });
}

async function listHistory({ actorUserId, query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;

    const scope = await getActorWarehouseScope(actorUserId);
    if (!scope.warehouseIds.length) {
        throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
    }

    const where = {
        delivery_partner_user_id: actorUserId,
        warehouse_id: { [Op.in]: scope.warehouseIds },
        status: query.status || { [Op.in]: ["delivered", "delivery_failed"] },
    };

    if (query.delivery_date) {
        where.delivery_date = query.delivery_date;
    }

    if (query.q) {
        where[Op.or] = [
            { order_number: { [Op.iLike]: `%${query.q}%` } },
            { delivery_name: { [Op.iLike]: `%${query.q}%` } },
            { delivery_phone: { [Op.iLike]: `%${query.q}%` } },
        ];
    }

    const { rows, count } = await Order.findAndCountAll({
        where,
        include: await getAssignedOrderInclude(),
        order: [
            ["delivery_date", "DESC"],
            ["updated_at", "DESC"],
        ],
        limit,
        offset,
        distinct: true,
    });

    let orders = rows.map((x) => x.toJSON());
    orders = attachAddressFallback(orders);
    sortProductImagesInOrderJson(orders);

    return {
        orders,
        page,
        limit,
        total: Number(count || 0),
    };
}

async function getAssignedOrderById({ actorUserId, orderId }) {
    const order = await Order.findByPk(orderId, {
        include: await getAssignedOrderInclude({ withEvents: true }),
        order: [
            [{ model: OrderStatusEvent, as: "status_events" }, "created_at", "ASC"],
        ],
    });

    await assertAssignedOrderAccess({ actorUserId, order });

    let json = order.toJSON();
    json = attachAddressFallback(json);
    sortProductImagesInOrderJson(json);

    return { order: json };
}

async function acceptAssignedOrder({ actorUserId, orderId, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await assertAssignedOrderAccess({ actorUserId, order });

        if (["cancelled", "refunded", "delivered"].includes(order.status)) {
            throw new AppError("ORDER_NOT_ACTIONABLE", "This order is not actionable", 400);
        }

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: order.status,
                to_status: order.status,
                actor_user_id: actorUserId,
                note: note || null,
                meta: {
                    source: "delivery",
                    action: "delivery_assignment_accepted",
                },
            },
            { transaction: t }
        );

        return {
            order: {
                id: order.id,
                status: order.status,
                delivery_partner_user_id: order.delivery_partner_user_id,
            },
        };
    });
}

async function pickAssignedOrder({ actorUserId, orderId, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await assertAssignedOrderAccess({ actorUserId, order });

        if (!["accepted", "packed", "out_for_delivery"].includes(order.status)) {
            throw new AppError("INVALID_ORDER_STAGE", "Order cannot be picked at this stage", 400);
        }

        if (!order.picked_at) {
            await order.update(
                {
                    picked_at: new Date(),
                    delivery_notes: note || order.delivery_notes || null,
                },
                { transaction: t }
            );
        }

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: order.status,
                to_status: order.status,
                actor_user_id: actorUserId,
                note: note || null,
                meta: {
                    source: "delivery",
                    action: "picked",
                },
            },
            { transaction: t }
        );

        return {
            order: {
                id: order.id,
                status: order.status,
                picked_at: order.picked_at,
            },
        };
    });
}

async function startDelivery({ actorUserId, orderId, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await assertAssignedOrderAccess({ actorUserId, order });

        if (order.status !== "packed") {
            throw new AppError("INVALID_ORDER_STAGE", "Only packed orders can move to out_for_delivery", 400);
        }

        const now = new Date();

        await order.update(
            {
                status: "out_for_delivery",
                picked_at: order.picked_at || now,
                out_for_delivery_at: now,
                is_locked: true,
                delivery_notes: note || order.delivery_notes || null,
                delivery_failure_reason: null,
                delivery_failed_at: null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: "packed",
                to_status: "out_for_delivery",
                actor_user_id: actorUserId,
                note: note || null,
                meta: {
                    source: "delivery",
                    action: "started_delivery",
                },
            },
            { transaction: t }
        );

        await createNotification({
            userId: order.user_id,
            template: "order_status_changed",
            payload: {
                order_id: order.id,
                from_status: "packed",
                to_status: "out_for_delivery",
            },
            transaction: t,
        });

        return {
            order: {
                id: order.id,
                status: order.status,
                out_for_delivery_at: order.out_for_delivery_at,
            },
        };
    });
}

async function markDelivered({ actorUserId, orderId, customerOtp, proofImageUrl, recipientName, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await assertAssignedOrderAccess({ actorUserId, order });

        if (order.status !== "out_for_delivery") {
            throw new AppError("INVALID_ORDER_STAGE", "Only out_for_delivery orders can be marked delivered", 400);
        }

        if (order.customer_delivery_otp_hash) {
            if (!customerOtp) {
                throw new AppError("DELIVERY_OTP_REQUIRED", "Customer delivery OTP is required", 400);
            }

            if (
                order.customer_delivery_otp_expires_at &&
                new Date(order.customer_delivery_otp_expires_at).getTime() < Date.now()
            ) {
                throw new AppError("DELIVERY_OTP_EXPIRED", "Customer delivery OTP has expired", 400);
            }

            if (hashOtp(customerOtp) !== order.customer_delivery_otp_hash) {
                throw new AppError("DELIVERY_OTP_INVALID", "Invalid customer delivery OTP", 400);
            }
        }

        const now = new Date();

        await order.update(
            {
                status: "delivered",
                delivered_at: now,
                is_locked: true,
                retry_allowed: false,
                refund_status: order.refund_status || "none",
                delivery_notes: note || order.delivery_notes || null,
                delivery_proof_image_url: proofImageUrl || order.delivery_proof_image_url || null,
                delivery_failure_reason: null,
                delivery_failed_at: null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: "out_for_delivery",
                to_status: "delivered",
                actor_user_id: actorUserId,
                note: note || recipientName || null,
                meta: {
                    source: "delivery",
                    action: "delivered",
                    proof_image_url: proofImageUrl || null,
                    recipient_name: recipientName || null,
                },
            },
            { transaction: t }
        );

        await createNotification({
            userId: order.user_id,
            template: "order_status_changed",
            payload: {
                order_id: order.id,
                from_status: "out_for_delivery",
                to_status: "delivered",
            },
            transaction: t,
        });

        return {
            order: {
                id: order.id,
                status: order.status,
                delivered_at: order.delivered_at,
                delivery_proof_image_url: order.delivery_proof_image_url,
            },
        };
    });
}

async function markFailed({ actorUserId, orderId, reason, proofImageUrl, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await assertAssignedOrderAccess({ actorUserId, order });

        if (order.status !== "out_for_delivery") {
            throw new AppError("INVALID_ORDER_STAGE", "Only out_for_delivery orders can be marked failed", 400);
        }

        const now = new Date();
        const attempts = Number(order.delivery_attempt_count || 0) + 1;

        await order.update(
            {
                status: "delivery_failed",
                delivery_failed_at: now,
                delivery_attempt_count: attempts,
                delivery_failure_reason: reason,
                delivery_notes: note || order.delivery_notes || null,
                delivery_proof_image_url: proofImageUrl || order.delivery_proof_image_url || null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: "out_for_delivery",
                to_status: "delivery_failed",
                actor_user_id: actorUserId,
                note: note || reason,
                meta: {
                    source: "delivery",
                    action: "delivery_failed",
                    reason,
                    proof_image_url: proofImageUrl || null,
                    attempt_count: attempts,
                },
            },
            { transaction: t }
        );

        await createNotification({
            userId: order.user_id,
            template: "order_status_changed",
            payload: {
                order_id: order.id,
                from_status: "out_for_delivery",
                to_status: "delivery_failed",
            },
            transaction: t,
        });

        return {
            order: {
                id: order.id,
                status: order.status,
                delivery_failed_at: order.delivery_failed_at,
                delivery_attempt_count: order.delivery_attempt_count,
                delivery_failure_reason: order.delivery_failure_reason,
            },
        };
    });
}

module.exports = {
    listAssignedOrders,
    listTodayOrders,
    listHistory,
    getAssignedOrderById,
    acceptAssignedOrder,
    pickAssignedOrder,
    startDelivery,
    markDelivered,
    markFailed,
};