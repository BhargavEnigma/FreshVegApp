"use strict";

const { Op } = require("sequelize");
const {
    sequelize,
    UserRole,
    UserWarehouseAssignment,
} = require("../../models");
const { AppError } = require("../../utils/errors");

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

function buildWarehouseSql({ scope, warehouse_id, replacements }) {
    if (scope.isAdmin) {
        if (warehouse_id) {
            replacements.warehouse_id = warehouse_id;
            return " AND o.warehouse_id = :warehouse_id ";
        }

        return "";
    }

    if (!scope.warehouseIds.length) {
        throw new AppError("WAREHOUSE_SCOPE_MISSING", "No warehouse assigned to this user", 403);
    }

    if (warehouse_id && !scope.warehouseIds.includes(warehouse_id)) {
        throw new AppError("FORBIDDEN", "You cannot access another warehouse", 403);
    }

    replacements.warehouse_ids = warehouse_id ? [warehouse_id] : scope.warehouseIds;
    return " AND o.warehouse_id IN (:warehouse_ids) ";
}

async function procurementSummary({ actorUserId, delivery_date, warehouse_id }) {
    if (!delivery_date) {
        throw new AppError("DELIVERY_DATE_REQUIRED", "delivery_date is required", 400);
    }

    const scope = await getActorWarehouseScope(actorUserId);

    const replacements = { delivery_date };
    const warehouseSql = buildWarehouseSql({ scope, warehouse_id, replacements });

    const items = await sequelize.query(
        `
        SELECT
            oi.product_id,
            oi.product_name,
            oi.product_pack_id,
            oi.pack_label,
            oi.unit,
            SUM(oi.quantity)::text AS total_quantity,
            SUM(oi.line_total_paise)::bigint::text AS total_sales_paise,
            COUNT(DISTINCT o.id)::int AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.delivery_date = :delivery_date
          ${warehouseSql}
          AND o.is_locked = true
          AND o.status NOT IN ('cancelled', 'refunded', 'payment_pending')
          AND (
            o.payment_status = 'paid'
            OR o.payment_method = 'cod'
          )
        GROUP BY
            oi.product_id,
            oi.product_name,
            oi.product_pack_id,
            oi.pack_label,
            oi.unit
        ORDER BY oi.product_name ASC, oi.pack_label ASC NULLS LAST
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    const summaryRows = await sequelize.query(
        `
        SELECT
            COUNT(*)::int AS total_orders,

            COUNT(*) FILTER (
                WHERE o.is_locked = true
                  AND o.status NOT IN ('cancelled', 'refunded', 'payment_pending')
                  AND (
                    o.payment_status = 'paid'
                    OR o.payment_method = 'cod'
                  )
            )::int AS valid_procurement_orders,

            COUNT(*) FILTER (
                WHERE o.payment_method = 'cod'
            )::int AS cod_orders,

            COUNT(*) FILTER (
                WHERE o.payment_method <> 'cod'
                  AND o.payment_status = 'paid'
            )::int AS paid_online_orders,

            COUNT(*) FILTER (
                WHERE o.status = 'payment_pending'
                   OR o.payment_status = 'pending'
            )::int AS payment_pending_orders,

            COUNT(*) FILTER (
                WHERE o.status IN ('cancelled', 'refunded')
            )::int AS cancelled_orders,

            COUNT(*) FILTER (
                WHERE o.delivery_partner_user_id IS NULL
            )::int AS unassigned_delivery_orders,

            COUNT(*) FILTER (
                WHERE o.is_locked = true
            )::int AS locked_orders,

            COUNT(*) FILTER (
                WHERE o.is_locked = false
                   OR o.is_locked IS NULL
            )::int AS unlocked_orders,

            COALESCE(SUM(o.grand_total_paise) FILTER (
                WHERE o.is_locked = true
                  AND o.status NOT IN ('cancelled', 'refunded', 'payment_pending')
                  AND (
                    o.payment_status = 'paid'
                    OR o.payment_method = 'cod'
                  )
            ), 0)::bigint::text AS valid_order_value_paise
        FROM orders o
        WHERE o.delivery_date = :delivery_date
        ${warehouseSql}
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    const statusRows = await sequelize.query(
        `
        SELECT
            COALESCE(o.status, 'unknown') AS label,
            COUNT(*)::int AS value
        FROM orders o
        WHERE o.delivery_date = :delivery_date
        ${warehouseSql}
        GROUP BY COALESCE(o.status, 'unknown')
        ORDER BY label ASC
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    const summary = summaryRows[0] || {};

    return {
        delivery_date,
        warehouse_id: warehouse_id || null,
        items,
        summary: {
            total_orders: Number(summary.total_orders || 0),
            valid_procurement_orders: Number(summary.valid_procurement_orders || 0),
            ignored_orders:
                Number(summary.total_orders || 0) -
                Number(summary.valid_procurement_orders || 0),
            cod_orders: Number(summary.cod_orders || 0),
            paid_online_orders: Number(summary.paid_online_orders || 0),
            payment_pending_orders: Number(summary.payment_pending_orders || 0),
            cancelled_orders: Number(summary.cancelled_orders || 0),
            unassigned_delivery_orders: Number(summary.unassigned_delivery_orders || 0),
            locked_orders: Number(summary.locked_orders || 0),
            unlocked_orders: Number(summary.unlocked_orders || 0),
            valid_order_value_paise: Number(summary.valid_order_value_paise || 0),
            is_fully_locked:
                Number(summary.total_orders || 0) > 0 &&
                Number(summary.unlocked_orders || 0) === 0,
        },
        status_breakdown: statusRows.map((row) => ({
            label: row.label,
            value: Number(row.value || 0),
        })),
    };
}

module.exports = { procurementSummary };