"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const safeAddColumn = async (table, column, def) => {
            try {
                await queryInterface.addColumn(table, column, def);
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

        const safeAddIndex = async (table, fields, options) => {
            try {
                await queryInterface.addIndex(table, fields, options);
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

        await safeAddColumn("payments", "provider_order_id", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        // Razorpay webhook/event id (helps idempotency across retries)
        await safeAddColumn("payments", "provider_event_id", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        // Uniqueness for gateway ids (partial unique indexes)
        await safeAddIndex(
            "payments",
            ["provider", "provider_payment_id"],
            {
                name: "payments_provider_payment_id_uniq",
                unique: true,
                where: { provider_payment_id: { [Sequelize.Op.ne]: null } },
            }
        );

        await safeAddIndex(
            "payments",
            ["provider", "provider_order_id"],
            {
                name: "payments_provider_order_id_uniq",
                unique: true,
                where: { provider_order_id: { [Sequelize.Op.ne]: null } },
            }
        );

        await safeAddIndex(
            "payments",
            ["provider", "provider_event_id"],
            {
                name: "payments_provider_event_id_uniq",
                unique: true,
                where: { provider_event_id: { [Sequelize.Op.ne]: null } },
            }
        );
    },

    async down(queryInterface) {
        // Best-effort rollback
        await queryInterface.removeIndex("payments", "payments_provider_event_id_uniq").catch(() => {});
        await queryInterface.removeIndex("payments", "payments_provider_order_id_uniq").catch(() => {});
        await queryInterface.removeIndex("payments", "payments_provider_payment_id_uniq").catch(() => {});

        await queryInterface.removeColumn("payments", "provider_event_id").catch(() => {});
        await queryInterface.removeColumn("payments", "provider_order_id").catch(() => {});
    },
};
