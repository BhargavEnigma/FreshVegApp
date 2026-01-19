"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {

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

        await queryInterface.addColumn("orders", "gst_rate_bps", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await queryInterface.addColumn("orders", "gst_amount_paise", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await queryInterface.addColumn("orders", "grand_total_paise", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await safeQuery(`ALTER TABLE orders ADD CONSTRAINT orders_gst_rate_bps_check CHECK (gst_rate_bps >= 0);`);
        await safeQuery(`ALTER TABLE orders ADD CONSTRAINT orders_gst_amount_paise_check CHECK (gst_amount_paise >= 0);`);
        await safeQuery(`ALTER TABLE orders ADD CONSTRAINT orders_grand_total_paise_check CHECK (grand_total_paise >= 0);`);
    },

    async down(queryInterface) {
        const safeQuery = async (sql) => {
            try {
                await queryInterface.sequelize.query(sql);
            } catch (e) {
                // ignore
            }
        };

        await safeQuery(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_gst_rate_bps_check;`);
        await safeQuery(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_gst_amount_paise_check;`);
        await safeQuery(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_grand_total_paise_check;`);

        await queryInterface.removeColumn("orders", "grand_total_paise");
        await queryInterface.removeColumn("orders", "gst_amount_paise");
        await queryInterface.removeColumn("orders", "gst_rate_bps");
    },
};
