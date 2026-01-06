"use strict";

module.exports = {
    async up(queryInterface) {
        const safeQuery = async (sql) => {
            try {
                await queryInterface.sequelize.query(sql);
            } catch (e) {
                const msg = String(e?.message || "");
                if (
                    msg.includes("already exists") ||
                    msg.includes("Duplicate") ||
                    msg.includes("duplicate") ||
                    msg.includes("exists")
                ) {
                    return;
                }
                throw e;
            }
        };

        // Drop old constraint if exists
        await safeQuery(`
            ALTER TABLE orders
            DROP CONSTRAINT IF EXISTS orders_status_check;
        `);

        // Add updated constraint
        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_status_check
            CHECK (
                status IN (
                    'payment_pending',
                    'placed',
                    'confirmed',
                    'locked',
                    'accepted',
                    'packed',
                    'out_for_delivery',
                    'delivered',
                    'cancelled',
                    'refunded'
                )
            );
        `);
    },

    async down(queryInterface) {
        // revert to old one (your previous set)
        await queryInterface.sequelize.query(`
            ALTER TABLE orders
            DROP CONSTRAINT IF EXISTS orders_status_check;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_status_check
            CHECK (status IN ('placed','confirmed','packed','out_for_delivery','delivered','cancelled','refunded'));
        `);
    },
};
