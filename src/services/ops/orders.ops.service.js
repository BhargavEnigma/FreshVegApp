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
    UserWarehouseAssignment,
    UserRole
} = require("../../models");
const { AppError } = require("../../utils/errors");
// const InventoryService = require("../inventory.service");

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

async function getActorWarehouseScope(actorUserId) {
    const rolesRows = await UserRole.findAll({
        where: { user_id: actorUserId },
        attributes: ["role"],
    });

    const roles = rolesRows.map((r) => r.role);
    if (roles.includes("admin")) {
        return { isAdmin: true, warehouseIds: [] };
    }

    const assignments = await UserWarehouseAssignment.findAll({
        where: { user_id: actorUserId },
        attributes: ["warehouse_id"],
    });

    return {
        isAdmin: false,
        warehouseIds: assignments.map((x) => x.warehouse_id),
    };
}

async function assertDeliveryPartnerEligible({ deliveryPartnerUserId, warehouseId, transaction }) {
    const partner = await User.findByPk(deliveryPartnerUserId, {
        attributes: ["id", "phone", "full_name", "status"],
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });

    if (!partner) {
        throw new AppError("DELIVERY_PARTNER_NOT_FOUND", "Delivery partner not found", 404);
    }

    if (partner.status !== "active") {
        throw new AppError("DELIVERY_PARTNER_BLOCKED", "Delivery partner is blocked", 400);
    }

    const role = await UserRole.findOne({
        where: {
            user_id: deliveryPartnerUserId,
            role: "delivery_partner",
        },
        transaction,
    });

    if (!role) {
        throw new AppError("INVALID_DELIVERY_PARTNER", "Selected user is not a delivery partner", 400);
    }

    const whAssignment = await UserWarehouseAssignment.findOne({
        where: {
            user_id: deliveryPartnerUserId,
            warehouse_id: warehouseId,
        },
        transaction,
    });

    if (!whAssignment) {
        throw new AppError(
            "DELIVERY_PARTNER_WAREHOUSE_MISMATCH",
            "Delivery partner is not assigned to this warehouse",
            400
        );
    }

    return partner;
}

async function assertOrderAccessScope({ actorUserId, order }) {
    const scope = await getActorWarehouseScope(actorUserId);

    if (scope.isAdmin) {
        return;
    }

    if (!scope.warehouseIds.length) {
        throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
    }

    if (!scope.warehouseIds.includes(order.warehouse_id)) {
        throw new AppError("FORBIDDEN", "You cannot access this order", 403);
    }
}

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

function assertDeliveryPartnerRequired(order, toStatus) {
    const needsDeliveryPartner = ["out_for_delivery", "delivered"].includes(toStatus);

    if (
        order.status === "packed" &&
        needsDeliveryPartner &&
        !order.delivery_partner_user_id
    ) {
        throw new AppError(
            "DELIVERY_PARTNER_REQUIRED",
            "Assign a delivery partner before moving packed order to out for delivery or delivered",
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

function buildStatusPatch(toStatus) {
    const patch = { status: toStatus };

    if (toStatus === "cancelled") {
        patch.is_locked = false;
        patch.cancelled_at = new Date();
    }

    if (toStatus === "delivered") {
        patch.is_locked = true;
    }

    if (["accepted", "packed", "out_for_delivery"].includes(toStatus)) {
        patch.is_locked = true;
    }

    return patch;
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

async function list({ actorUserId, query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const offset = (page - 1) * limit;

    const where = {};
    const scope = await getActorWarehouseScope(actorUserId);

    if (!scope.isAdmin) {
        if (!scope.warehouseIds.length) {
            throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
        }

        if (query.warehouse_id && !scope.warehouseIds.includes(query.warehouse_id)) {
            throw new AppError("FORBIDDEN", "You cannot access another warehouse", 403);
        }

        where.warehouse_id = query.warehouse_id || { [Op.in]: scope.warehouseIds };
    } else if (query.warehouse_id) {
        where.warehouse_id = query.warehouse_id;
    }

    if (query.status) {
        where.status = query.status;
    }

    if (query.delivery_date) {
        where.delivery_date = query.delivery_date;
    }

    if (query.delivery_partner_user_id) {
        // if (query.delivery_partner_user_id === "unassigned") {
        //     where.delivery_partner_user_id = null;
        // } else {
        where.delivery_partner_user_id = query.delivery_partner_user_id;
        // }
    }

    if (query.isOrderAssigned !== undefined) {
        const isAssigned =
            String(query.isOrderAssigned).toLowerCase() === "true";

        if (isAssigned) {
            where.delivery_partner_user_id = {
                [Op.and]: [
                    { [Op.ne]: null },
                    { [Op.ne]: "" },
                ],
            };
        } else {
            where[Op.or] = [
                ...(where[Op.or] || []),
                { delivery_partner_user_id: null },
                { delivery_partner_user_id: "" },
            ];
        }
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
            { model: User, as: "delivery_partner", required: false, attributes: ["id", "phone", "full_name"] },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
    });

    let jsonOrders = rows.map((r) => r.toJSON());
    jsonOrders = attachAddressFallback(jsonOrders);
    sortProductImagesInOrdersJson(jsonOrders);

    return {
        orders: jsonOrders,
        page,
        limit,
        total: count,
    };
}

async function listDeliveryPartners({ actorUserId, query }) {
    const scope = await getActorWarehouseScope(actorUserId);

    let warehouseFilter = null;

    if (!scope.isAdmin) {
        if (!scope.warehouseIds.length) {
            throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
        }

        if (query.warehouse_id && !scope.warehouseIds.includes(query.warehouse_id)) {
            throw new AppError("FORBIDDEN", "You cannot access another warehouse", 403);
        }

        warehouseFilter = query.warehouse_id || { [Op.in]: scope.warehouseIds };
    } else if (query.warehouse_id) {
        warehouseFilter = query.warehouse_id;
    }

    const where = { status: "active" };

    if (query.q) {
        const q = String(query.q).trim();
        where[Op.or] = [
            { full_name: { [Op.iLike]: `%${q}%` } },
            { phone: { [Op.iLike]: `%${q}%` } },
        ];
    }

    const warehouseInclude = {
        model: UserWarehouseAssignment,
        as: "warehouse_assignments",
        attributes: ["warehouse_id"],
        required: !!warehouseFilter,
    };

    if (warehouseFilter) {
        warehouseInclude.where = {
            warehouse_id: warehouseFilter,
        };
    }

    const rows = await User.findAll({
        where,
        include: [
            {
                model: UserRole,
                as: "roles",
                attributes: ["role"],
                where: { role: "delivery_partner" },
                required: true,
            },
            warehouseInclude,
        ],
        order: [
            ["full_name", "ASC"],
            ["phone", "ASC"],
        ],
        distinct: true,
    });

    return {
        partners: rows.map((u) => ({
            id: u.id,
            full_name: u.full_name,
            phone: u.phone,
            status: u.status,
            warehouse_ids: (u.warehouse_assignments || []).map((x) => x.warehouse_id),
        })),
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
    const where = {};
    const scope = await getActorWarehouseScope(actorUserId);

    if (!scope.isAdmin) {
        if (!scope.warehouseIds.length) {
            throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
        }

        if (query.warehouse_id && !scope.warehouseIds.includes(query.warehouse_id)) {
            throw new AppError("FORBIDDEN", "You cannot access another warehouse", 403);
        }

        where.warehouse_id = query.warehouse_id || { [Op.in]: scope.warehouseIds };
    } else if (query.warehouse_id) {
        where.warehouse_id = query.warehouse_id;
    }

    if (query.status) where.status = query.status;
    if (query.delivery_date) where.delivery_date = query.delivery_date;
    if (query.delivery_partner_user_id) {
        if (query.delivery_partner_user_id === "unassigned") {
            where.delivery_partner_user_id = null;
        } else {
            where.delivery_partner_user_id = query.delivery_partner_user_id;
        }
    }

    const orders = await Order.findAll({
        where,
        include: [
            { model: Warehouse, as: "warehouse", required: false, attributes: ["id", "name"] },
            { model: User, as: "user", required: false, attributes: ["id", "phone", "full_name"] },
            { model: User, as: "delivery_partner", required: false, attributes: ["id", "phone", "full_name"] },
        ],
        order: [["created_at", "DESC"]],
    });

    const headers = [
        "order_number",
        "order_id",
        "status",
        "delivery_date",
        "delivery_partner_name",
        "delivery_partner_phone",
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
            x.delivery_partner?.full_name || "",
            x.delivery_partner?.phone || "",
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
            { model: User, as: "delivery_partner", required: false, attributes: ["id", "phone", "full_name"] },
            { model: User, as: "delivery_assigned_by", required: false, attributes: ["id", "phone", "full_name"] },
        ],
        order: [[{ model: OrderItem, as: "items" }, "created_at", "ASC"]],
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    await assertOrderAccessScope({ actorUserId, order });

    let json = order.toJSON();
    json = attachAddressFallback(json);

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

async function assignDeliveryPartner({ actorUserId, orderId, deliveryPartnerUserId, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        await assertOrderAccessScope({ actorUserId, order });

        if (["out_for_delivery", "delivered", "cancelled", "refunded"].includes(order.status)) {
            throw new AppError(
                "ORDER_NOT_ASSIGNABLE",
                "Delivery partner cannot be changed at this stage",
                400
            );
        }

        const partner = await assertDeliveryPartnerEligible({
            deliveryPartnerUserId,
            warehouseId: order.warehouse_id,
            transaction: t,
        });

        const previousDeliveryPartnerUserId = order.delivery_partner_user_id || null;
        const now = new Date();

        await order.update(
            {
                delivery_partner_user_id: partner.id,
                delivery_assigned_at: now,
                delivery_assigned_by_user_id: actorUserId,
                delivery_failure_reason: null,
                delivery_failed_at: null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: order.status,
                to_status: order.status,
                actor_user_id: actorUserId,
                note: note || null,
                meta: {
                    source: "ops",
                    action: previousDeliveryPartnerUserId ? "delivery_partner_reassigned" : "delivery_partner_assigned",
                    delivery_partner_user_id: partner.id,
                    previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
                },
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: partner.id,
                channel: "push",
                template: "delivery_assigned",
                payload: {
                    order_id: order.id,
                    order_number: order.order_number,
                    delivery_date: order.delivery_date,
                    address_line1: order.delivery_address_line1 || null,
                    area: order.delivery_area || null,
                },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return {
            order: {
                id: order.id,
                status: order.status,
                delivery_partner_user_id: order.delivery_partner_user_id,
                delivery_assigned_at: order.delivery_assigned_at,
                delivery_assigned_by_user_id: order.delivery_assigned_by_user_id,
            },
            delivery_partner: {
                id: partner.id,
                full_name: partner.full_name,
                phone: partner.phone,
            },
        };
    });
}

async function unassignDeliveryPartner({ actorUserId, orderId, note }) {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
        }

        await assertOrderAccessScope({ actorUserId, order });

        if (["out_for_delivery", "delivered"].includes(order.status)) {
            throw new AppError(
                "ORDER_NOT_UNASSIGNABLE",
                "Cannot unassign delivery partner after delivery has started",
                400
            );
        }

        if (!order.delivery_partner_user_id) {
            return {
                order: {
                    id: order.id,
                    status: order.status,
                    delivery_partner_user_id: null,
                },
            };
        }

        const previousDeliveryPartnerUserId = order.delivery_partner_user_id;

        await order.update(
            {
                delivery_partner_user_id: null,
                delivery_assigned_at: null,
                delivery_assigned_by_user_id: null,
            },
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: order.status,
                to_status: order.status,
                actor_user_id: actorUserId,
                note: note || null,
                meta: {
                    source: "ops",
                    action: "delivery_partner_unassigned",
                    previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
                },
            },
            { transaction: t }
        );

        return {
            order: {
                id: order.id,
                status: order.status,
                delivery_partner_user_id: null,
            },
            previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
        };
    });
}

async function bulkAssignDeliveryPartner({ actorUserId, orderIds, deliveryPartnerUserId, note }) {
    return sequelize.transaction(async (t) => {
        const orders = await Order.findAll({
            where: {
                id: { [Op.in]: orderIds },
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (orders.length !== orderIds.length) {
            throw new AppError(
                "ORDER_NOT_FOUND",
                "One or more selected orders were not found",
                404
            );
        }

        const warehouseIds = Array.from(new Set(orders.map((order) => order.warehouse_id)));

        if (warehouseIds.length !== 1) {
            throw new AppError(
                "MULTI_WAREHOUSE_ASSIGN_NOT_ALLOWED",
                "Selected orders must belong to the same warehouse",
                400
            );
        }

        for (const order of orders) {
            await assertOrderAccessScope({ actorUserId, order });

            if (["out_for_delivery", "delivered", "cancelled", "refunded"].includes(order.status)) {
                throw new AppError(
                    "ORDER_NOT_ASSIGNABLE",
                    `Order ${order.order_number || order.id} cannot be assigned at this stage`,
                    400
                );
            }
        }

        const partner = await assertDeliveryPartnerEligible({
            deliveryPartnerUserId,
            warehouseId: warehouseIds[0],
            transaction: t,
        });

        const now = new Date();

        for (const order of orders) {
            const previousDeliveryPartnerUserId = order.delivery_partner_user_id || null;

            await order.update(
                {
                    delivery_partner_user_id: partner.id,
                    delivery_assigned_at: now,
                    delivery_assigned_by_user_id: actorUserId,
                    delivery_failure_reason: null,
                    delivery_failed_at: null,
                },
                { transaction: t }
            );

            await OrderStatusEvent.create(
                {
                    order_id: order.id,
                    from_status: order.status,
                    to_status: order.status,
                    actor_user_id: actorUserId,
                    note: note || null,
                    meta: {
                        source: "ops",
                        action: previousDeliveryPartnerUserId
                            ? "delivery_partner_bulk_reassigned"
                            : "delivery_partner_bulk_assigned",
                        delivery_partner_user_id: partner.id,
                        previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
                    },
                },
                { transaction: t }
            );
        }

        await Notification.create(
            {
                user_id: partner.id,
                channel: "push",
                template: "delivery_bulk_assigned",
                payload: {
                    order_ids: orders.map((order) => order.id),
                    order_count: orders.length,
                    delivery_date: orders[0]?.delivery_date || null,
                },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return {
            assigned_count: orders.length,
            order_ids: orders.map((order) => order.id),
            delivery_partner: {
                id: partner.id,
                full_name: partner.full_name,
                phone: partner.phone,
            },
        };
    });
}

async function bulkUnassignDeliveryPartner({ actorUserId, orderIds, deliveryPartnerUserId, note }) {
    return sequelize.transaction(async (t) => {
        const orders = await Order.findAll({
            where: {
                id: { [Op.in]: orderIds },
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (orders.length !== orderIds.length) {
            throw new AppError(
                "ORDER_NOT_FOUND",
                "One or more selected orders were not found",
                404
            );
        }

        for (const order of orders) {
            await assertOrderAccessScope({ actorUserId, order });

            if (["out_for_delivery", "delivered"].includes(order.status)) {
                throw new AppError(
                    "ORDER_NOT_UNASSIGNABLE",
                    `Order ${order.order_number || order.id} cannot be unassigned after delivery has started`,
                    400
                );
            }
        }

        const changedOrders = [];

        for (const order of orders) {
            const previousDeliveryPartnerUserId = order.delivery_partner_user_id || null;

            if (!previousDeliveryPartnerUserId) {
                continue;
            }

            await order.update(
                {
                    delivery_partner_user_id: null,
                    delivery_assigned_at: null,
                    delivery_assigned_by_user_id: null,
                },
                { transaction: t }
            );

            await OrderStatusEvent.create(
                {
                    order_id: order.id,
                    from_status: order.status,
                    to_status: order.status,
                    actor_user_id: actorUserId,
                    note: note || null,
                    meta: {
                        source: "ops",
                        action: "delivery_partner_bulk_unassigned",
                        previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
                    },
                },
                { transaction: t }
            );

            changedOrders.push({
                id: order.id,
                order_number: order.order_number,
                previous_delivery_partner_user_id: previousDeliveryPartnerUserId,
            });
        }

        return {
            unassigned_count: changedOrders.length,
            skipped_count: orders.length - changedOrders.length,
            order_ids: changedOrders.map((order) => order.id),
            orders: changedOrders,
        };
    });
}

async function bulkUpdateStatus({ actorUserId, orderIds, to_status, note }) {
    return sequelize.transaction(async (t) => {
        const orders = await Order.findAll({
            where: {
                id: { [Op.in]: orderIds },
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        console.log('orders : ',  orders);

        if (orders.length !== orderIds.length) {
            throw new AppError(
                "ORDER_NOT_FOUND",
                "One or more selected orders were not found",
                404
            );
        }

        const changedOrders = [];
        const skippedOrders = [];

        for (const order of orders) {
            await assertOrderAccessScope({ actorUserId, order });

            const fromStatus = order.status;

            if (fromStatus === to_status) {
                skippedOrders.push({
                    id: order.id,
                    order_number: order.order_number,
                    status: order.status,
                    reason: "already_in_target_status",
                });
                continue;
            }

            assertTransition(fromStatus, to_status);
            assertDeliveryPartnerRequired(order, to_status);

            const patch = buildStatusPatch(to_status);

            await order.update(patch, { transaction: t });

            await OrderStatusEvent.create(
                {
                    order_id: order.id,
                    from_status: fromStatus,
                    to_status,
                    actor_user_id: actorUserId,
                    note: note || null,
                    meta: {
                        source: "ops",
                        action: "bulk_status_update",
                    },
                },
                { transaction: t }
            );

            await Notification.create(
                {
                    user_id: order.user_id,
                    channel: "push",
                    template: "order_status_changed",
                    payload: {
                        order_id: order.id,
                        from_status: fromStatus,
                        to_status,
                    },
                    status: "queued",
                    attempt_count: 0,
                    scheduled_at: null,
                },
                { transaction: t }
            );

            changedOrders.push({
                id: order.id,
                order_number: order.order_number,
                from_status: fromStatus,
                to_status,
                is_locked: order.is_locked,
            });
        }

        return {
            updated_count: changedOrders.length,
            skipped_count: skippedOrders.length,
            to_status,
            order_ids: changedOrders.map((order) => order.id),
            orders: changedOrders,
            skipped_orders: skippedOrders,
        };
    });
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

        await assertOrderAccessScope({ actorUserId, order });

        const fromStatus = order.status;
        if (fromStatus === to_status) {
            return { order: { id: order.id, status: order.status } };
        }

        assertTransition(fromStatus, to_status);
        assertDeliveryPartnerRequired(order, to_status);
        
        const patch = { status: to_status };

        if (to_status === "cancelled") {
            patch.is_locked = false;
            patch.cancelled_at = new Date();
        }
        if (to_status === "delivered") {
            patch.is_locked = true;
        }
        if (["accepted", "packed", "out_for_delivery"].includes(to_status)) {
            patch.is_locked = true;
        }

        await order.update(patch, { transaction: t });

        // if (to_status === "cancelled") {
        //     await InventoryService.releaseReservedInventoryForOrder({
        //         orderId: order.id,
        //         t,
        //     });
        // }

        // if (to_status === "delivered") {
        //     await InventoryService.consumeReservedInventoryForOrder({
        //         orderId: order.id,
        //         t,
        //     });
        // }

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
    listDeliveryPartners,
    getById,
    exportCsv,
    updateStatus,
    bulkUpdateStatus,
    assignDeliveryPartner,
    bulkAssignDeliveryPartner,
    unassignDeliveryPartner,
    bulkUnassignDeliveryPartner,
};