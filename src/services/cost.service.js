"use strict";

const { Op } = require("sequelize");
const {
    sequelize,
    CostEntry,
    ProcurementCost,
    Warehouse,
    User,
} = require("../models");

function buildCostWhere(query = {}) {
    const where = {};

    if (query.category) {
        where.category = query.category;
    }

    if (query.warehouse_id) {
        where.warehouse_id = query.warehouse_id;
    }

    if (query.status) {
        where.status = query.status;
    }

    if (query.from_date || query.to_date) {
        where.cost_date = {};
        if (query.from_date) where.cost_date[Op.gte] = query.from_date;
        if (query.to_date) where.cost_date[Op.lte] = query.to_date;
    }

    return where;
}

async function listCosts(query) {
    return CostEntry.findAll({
        where: buildCostWhere(query),
        include: [
            { model: Warehouse, as: "warehouse", required: false, attributes: ["id", "name"] },
            { model: User, as: "creator", required: false, attributes: ["id", "full_name", "phone"] },
        ],
        order: [["cost_date", "DESC"], ["created_at", "DESC"]],
    });
}

async function getCostById(id) {
    return CostEntry.findByPk(id, {
        include: [
            { model: Warehouse, as: "warehouse", required: false, attributes: ["id", "name"] },
            { model: User, as: "creator", required: false, attributes: ["id", "full_name", "phone"] },
        ],
    });
}

async function createCost({ payload, actorUserId }) {
    return CostEntry.create({
        ...payload,
        created_by: actorUserId,
    });
}

async function updateCost({ id, payload }) {
    const cost = await CostEntry.findByPk(id);
    if (!cost) return null;

    await cost.update(payload);
    return getCostById(id);
}

async function archiveCost(id) {
    const cost = await CostEntry.findByPk(id);
    if (!cost) return null;

    await cost.update({ status: "archived" });
    return cost;
}

async function summary(query) {
    const where = buildCostWhere({
        ...query,
        status: query.status || "active",
    });

    const rows = await CostEntry.findAll({
        where,
        attributes: [
            "category",
            [sequelize.fn("SUM", sequelize.col("amount_paise")), "amount_paise"],
        ],
        group: ["category"],
        raw: true,
    });

    const result = {
        total_paise: 0,
        procurement_paise: 0,
        delivery_paise: 0,
        packaging_paise: 0,
        misc_paise: 0,
    };

    for (const row of rows) {
        const key = `${row.category}_paise`;
        const amount = Number(row.amount_paise || 0);
        result[key] = amount;
        result.total_paise += amount;
    }

    return result;
}

async function procurementItems({ delivery_date, warehouse_id }) {
    const replacements = { delivery_date };
    let warehouseSql = "";

    if (warehouse_id) {
        replacements.warehouse_id = warehouse_id;
        warehouseSql = "AND o.warehouse_id = :warehouse_id";
    }

    const rows = await sequelize.query(
        `
        SELECT
            oi.product_id,
            oi.product_pack_id,
            oi.product_name,
            oi.pack_label,
            SUM(oi.quantity)::float AS ordered_quantity,
            COALESCE(MAX(pc.unit_cost_paise), 0) AS unit_cost_paise,
            COALESCE(MAX(pc.total_cost_paise), 0) AS total_cost_paise,
            MAX(pc.notes) AS notes
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN procurement_costs pc
            ON pc.delivery_date = o.delivery_date
            AND pc.product_id = oi.product_id
            AND (
                pc.product_pack_id = oi.product_pack_id
                OR (pc.product_pack_id IS NULL AND oi.product_pack_id IS NULL)
            )
        WHERE o.delivery_date = :delivery_date
          ${warehouseSql}
          AND o.status NOT IN ('cancelled', 'refunded', 'payment_pending')
          AND (
              o.payment_status = 'paid'
              OR o.payment_method = 'cod'
          )
        GROUP BY
            oi.product_id,
            oi.product_pack_id,
            oi.product_name,
            oi.pack_label
        ORDER BY oi.product_name ASC, oi.pack_label ASC NULLS LAST
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    return {
        delivery_date,
        warehouse_id: warehouse_id || null,
        items: rows,
    };
}

async function bulkUpsertProcurement({ payload, actorUserId }) {
    const saved = [];

    await sequelize.transaction(async (t) => {
        for (const item of payload.items) {
            const totalCostPaise = Math.round(
                Number(item.ordered_quantity) * Number(item.unit_cost_paise)
            );

            const where = {
                delivery_date: payload.delivery_date,
                product_id: item.product_id,
                product_pack_id: item.product_pack_id || null,
            };

            const existing = await ProcurementCost.findOne({
                where,
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const data = {
                delivery_date: payload.delivery_date,
                warehouse_id: payload.warehouse_id || null,
                product_id: item.product_id,
                product_pack_id: item.product_pack_id || null,
                product_name: item.product_name,
                pack_label: item.pack_label || null,
                ordered_quantity: item.ordered_quantity,
                unit_cost_paise: item.unit_cost_paise,
                total_cost_paise: totalCostPaise,
                notes: item.notes || null,
                created_by: actorUserId,
            };

            if (existing) {
                await existing.update(data, { transaction: t });
                saved.push(existing);
            } else {
                const row = await ProcurementCost.create(data, { transaction: t });
                saved.push(row);
            }
        }
    });

    return { count: saved.length };
}

async function profitOverview(query = {}) {
    const replacements = {};
    let dateSql = "";
    let warehouseSql = "";

    if (query.from_date) {
        replacements.from_date = query.from_date;
        dateSql += " AND o.delivery_date >= :from_date";
    }

    if (query.to_date) {
        replacements.to_date = query.to_date;
        dateSql += " AND o.delivery_date <= :to_date";
    }

    if (query.warehouse_id) {
        replacements.warehouse_id = query.warehouse_id;
        warehouseSql = " AND o.warehouse_id = :warehouse_id";
    }

    const revenueRows = await sequelize.query(
        `
        SELECT COALESCE(SUM(o.grand_total_paise), 0)::bigint AS revenue_paise
        FROM orders o
        WHERE o.status NOT IN ('cancelled', 'refunded', 'payment_pending')
          AND (
              o.payment_status = 'paid'
              OR o.payment_method = 'cod'
          )
          ${dateSql}
          ${warehouseSql}
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    const costSummary = await summary(query);

    const procurementRows = await sequelize.query(
        `
        SELECT COALESCE(SUM(total_cost_paise), 0)::bigint AS procurement_paise
        FROM procurement_costs
        WHERE 1 = 1
          ${query.from_date ? "AND delivery_date >= :from_date" : ""}
          ${query.to_date ? "AND delivery_date <= :to_date" : ""}
          ${query.warehouse_id ? "AND warehouse_id = :warehouse_id" : ""}
        `,
        {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        }
    );

    const revenuePaise = Number(revenueRows[0]?.revenue_paise || 0);
    const procurementPaise = Number(procurementRows[0]?.procurement_paise || 0);
    const manualCostPaise =
        Number(costSummary.delivery_paise || 0) +
        Number(costSummary.packaging_paise || 0) +
        Number(costSummary.misc_paise || 0);

    const totalCostPaise = procurementPaise + manualCostPaise;
    const profitPaise = revenuePaise - totalCostPaise;

    return {
        revenue_paise: revenuePaise,
        procurement_paise: procurementPaise,
        delivery_paise: costSummary.delivery_paise,
        packaging_paise: costSummary.packaging_paise,
        misc_paise: costSummary.misc_paise,
        total_cost_paise: totalCostPaise,
        profit_paise: profitPaise,
        margin_percent: revenuePaise > 0 ? Number(((profitPaise / revenuePaise) * 100).toFixed(2)) : 0,
    };
}

module.exports = {
    listCosts,
    getCostById,
    createCost,
    updateCost,
    archiveCost,
    summary,
    procurementItems,
    bulkUpsertProcurement,
    profitOverview,
};