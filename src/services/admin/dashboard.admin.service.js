"use strict";

const { Op, fn, col } = require("sequelize");
const { Order, User } = require("../../models");

function getIstDateString(date = new Date()) {
    const istMs = date.getTime() + 330 * 60 * 1000;
    const ist = new Date(istMs);

    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const d = String(ist.getUTCDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

function getIstDayRange(dateStr) {
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));

    const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    return { startUtc, endUtc };
}

async function getKpis({ range }) {
    const today = getIstDateString();

    const startDate = range?.start_date || today;
    const endDate = range?.end_date || today;

    const { startUtc: startCreatedUtc } = getIstDayRange(startDate);
    const { endUtc: endCreatedUtcExclusive } = getIstDayRange(endDate);

    const deliveryWhere =
        startDate === endDate
            ? { delivery_date: startDate }
            : { delivery_date: { [Op.between]: [startDate, endDate] } };

    const createdWhere = {
        created_at: {
            [Op.gte]: startCreatedUtc,
            [Op.lt]: endCreatedUtcExclusive,
        },
    };

    const [
        ordersCreated,
        ordersForDelivery,
        paymentPending,
        paidRevenue,
        totalDeliveredRevenuePaid,
        activeUsers,
        packingQueue,
        exceptionOrders,
    ] = await Promise.all([
        Order.count({ where: createdWhere }),

        Order.count({
            where: deliveryWhere,
        }),

        Order.count({
            where: {
                ...deliveryWhere,
                payment_method: "online",
                payment_status: {
                    [Op.in]: [
                        "pending",
                        "provider_order_created",
                        "verification_pending",
                        "failed",
                    ],
                },
            },
        }),

        Order.sum("total_paise", {
            where: {
                ...deliveryWhere,
                payment_status: "paid",
                status: {
                    [Op.notIn]: ["cancelled", "refunded"],
                },
            },
        }),

        Order.sum("total_paise", {
            where: {
                payment_status: "paid",
                status: "delivered",
            },
        }),

        User.count({
            where: {
                status: "active",
            },
        }),

        Order.count({
            where: {
                ...deliveryWhere,
                status: {
                    [Op.in]: ["locked", "accepted", "packed"],
                },
            },
        }),

        Order.count({
            where: {
                ...deliveryWhere,
                [Op.or]: [
                    { payment_status: "verification_pending" },
                    { payment_status: "failed" },
                    { payment_status: "refund_failed" },
                    { refund_status: "failed" },
                    { status: "payment_pending" },
                    {
                        status: "cancelled",
                        payment_status: "paid",
                    },
                ],
            },
        }),
    ]);

    const byStatusRows = await Order.findAll({
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        where: deliveryWhere,
        group: ["status"],
        raw: true,
    });

    const ordersByStatus = {};

    for (const row of byStatusRows) {
        ordersByStatus[row.status] = Number(row.count || 0);
    }

    return {
        range: {
            start_date: startDate,
            end_date: endDate,
            mode: "delivery_date",
        },

        orders_created: Number(ordersCreated || 0),
        orders_for_delivery: Number(ordersForDelivery || 0),
        payment_pending: Number(paymentPending || 0),
        packing_queue: Number(packingQueue || 0),
        revenue_paid_paise: Number(paidRevenue || 0),
        total_delivered_revenue_paid_paise: Number(totalDeliveredRevenuePaid || 0),
        active_users: Number(activeUsers || 0),
        exceptions: Number(exceptionOrders || 0),
        orders_by_status: ordersByStatus,
    };
}

module.exports = {
    getKpis,
};