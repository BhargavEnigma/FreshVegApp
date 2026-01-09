"use strict";

const { Op, fn, col } = require("sequelize");
const { Order, User } = require("../../models");

function getIstDateString(date = new Date()) {
    // IST = UTC + 5:30. Convert to IST and return YYYY-MM-DD.
    const istMs = date.getTime() + 330 * 60 * 1000;
    const ist = new Date(istMs);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const d = String(ist.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getIstDayRange(dateStr) {
    // dateStr is YYYY-MM-DD in IST.
    // Build a UTC range that represents that IST day.
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    // Start of day in IST -> UTC = IST - 5:30
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

    // Delivery date range can be compared directly on DATEONLY strings.
    const deliveryWhere = startDate === endDate
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
        activeUsers,
        packingQueue,
    ] = await Promise.all([
        Order.count({ where: createdWhere }),
        Order.count({ where: deliveryWhere }),
        Order.count({ where: { ...createdWhere, payment_status: "pending" } }),
        Order.sum("total_paise", { where: { ...createdWhere, payment_status: "paid" } }),
        User.count({ where: { status: "active" } }),
        Order.count({
            where: {
                ...deliveryWhere,
                status: { [Op.in]: ["locked", "accepted", "packed"] },
            },
        }),
    ]);

    // Count by status for the delivery day range (helps dashboard charts)
    const byStatusRows = await Order.findAll({
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        where: deliveryWhere,
        group: ["status"],
        raw: true,
    });

    const ordersByStatus = {};
    for (const r of byStatusRows) {
        ordersByStatus[r.status] = Number(r.count || 0);
    }

    return {
        range: { start_date: startDate, end_date: endDate },
        orders_created: Number(ordersCreated || 0),
        orders_for_delivery: Number(ordersForDelivery || 0),
        payment_pending: Number(paymentPending || 0),
        packing_queue: Number(packingQueue || 0),
        revenue_paid_paise: Number(paidRevenue || 0),
        active_users: Number(activeUsers || 0),
        orders_by_status: ordersByStatus,
    };
}

module.exports = {
    getKpis,
};
