"use strict";

const { sequelize } = require("../../models");

async function procurementSummary({ delivery_date }) {
    // Aggregates only LOCKED orders (is_locked = true)
    const rows = await sequelize.query(
        `
        SELECT
            oi.product_id,
            oi.product_name,
            oi.product_pack_id,
            oi.pack_label,
            SUM(oi.quantity)::text AS total_quantity
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.delivery_date = :delivery_date
          AND o.is_locked = true
          AND o.status IN ('placed','confirmed','packed','out_for_delivery','delivered')
          AND o.payment_status IN ('paid')
        GROUP BY oi.product_id, oi.product_name, oi.product_pack_id, oi.pack_label
        ORDER BY oi.product_name ASC, oi.pack_label ASC NULLS LAST
        `,
        {
            replacements: { delivery_date },
            type: sequelize.QueryTypes.SELECT,
        }
    );

    return { delivery_date, items: rows };
}

module.exports = { procurementSummary };
