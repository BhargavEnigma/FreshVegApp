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

        // Defaults:
        // - DELIVERY_FEE_FLAT_PAISE: 2000 (₹20)
        // - FREE_DELIVERY_MIN_SUBTOTAL_PAISE: 30000 (₹300)
        // - GST_RATE_BPS: 0 (0%). Set to 500 for 5%, 1800 for 18%, etc.
        await safeQuery(`
            INSERT INTO settings (key, value, updated_at)
            VALUES
                ('DELIVERY_FEE_FLAT_PAISE', '2000'::jsonb, NOW()),
                ('FREE_DELIVERY_MIN_SUBTOTAL_PAISE', '30000'::jsonb, NOW()),
                ('GST_RATE_BPS', '0'::jsonb, NOW())
            ON CONFLICT (key) DO NOTHING;
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            DELETE FROM settings
            WHERE key IN ('DELIVERY_FEE_FLAT_PAISE','FREE_DELIVERY_MIN_SUBTOTAL_PAISE','GST_RATE_BPS');
        `);
    },
};
