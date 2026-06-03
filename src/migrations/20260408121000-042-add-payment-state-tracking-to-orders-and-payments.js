"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const safeAddColumn = async (table, column, def) => {
            try {
                await queryInterface.addColumn(table, column, def);
            } catch (e) {
                const msg = String(e?.message || "");
                if (msg.includes("already exists") || msg.includes("exists")) return;
                throw e;
            }
        };

        const safeAddIndex = async (table, fields, options) => {
            try {
                await queryInterface.addIndex(table, fields, options);
            } catch (e) {
                const msg = String(e?.message || "");
                if (msg.includes("already exists") || msg.includes("exists")) return;
                throw e;
            }
        };

        const safeQuery = async (sql) => {
            try {
                await queryInterface.sequelize.query(sql);
            } catch (e) {
                const msg = String(e?.message || "");
                if (
                    msg.includes("already exists") ||
                    msg.includes("exists") ||
                    msg.includes("does not exist")
                ) {
                    return;
                }
                throw e;
            }
        };

        await safeAddColumn("orders", "retry_allowed", {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await safeAddColumn("orders", "refund_status", {
            type: Sequelize.TEXT,
            allowNull: false,
            defaultValue: "none",
        });

        await safeAddColumn("orders", "current_payment_attempt_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "payment_attempts", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });

        await safeAddIndex("orders", ["current_payment_attempt_id"], {
            name: "orders_current_payment_attempt_idx",
        });

        await safeAddIndex("refunds", ["provider_refund_id"], {
            name: "refunds_provider_refund_id_uniq",
            unique: true,
            where: {
                provider_refund_id: { [Sequelize.Op.ne]: null },
            },
        });

        await safeAddIndex("refunds", ["order_id", "status"], {
            name: "refunds_order_status_idx",
        });

        await safeQuery(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;`);
        await safeQuery(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;`);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_payment_status_check
            CHECK (payment_status IN ('pending','provider_order_created','verification_pending','paid','failed','refund_pending','refunded','refund_failed'));
        `);

        await safeQuery(`
            ALTER TABLE payments
            ADD CONSTRAINT payments_status_check
            CHECK (status IN ('pending','provider_order_created','verification_pending','paid','failed','refund_pending','refunded','refund_failed'));
        `);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_refund_status_check
            CHECK (refund_status IN ('none','refund_pending','refunded','refund_failed'));
        `);

        await queryInterface.sequelize.query(`
            UPDATE orders
            SET
                retry_allowed = CASE
                    WHEN payment_method = 'online' AND status = 'payment_pending' AND payment_status IN ('pending','provider_order_created','verification_pending','failed') THEN true
                    ELSE false
                END,
                refund_status = CASE
                    WHEN payment_status = 'refunded' THEN 'refunded'
                    ELSE 'none'
                END
            WHERE retry_allowed IS DISTINCT FROM CASE
                    WHEN payment_method = 'online' AND status = 'payment_pending' AND payment_status IN ('pending','provider_order_created','verification_pending','failed') THEN true
                    ELSE false
                END
               OR refund_status IS DISTINCT FROM CASE
                    WHEN payment_status = 'refunded' THEN 'refunded'
                    ELSE 'none'
                END;
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex("refunds", "refunds_order_status_idx").catch(() => {});
        await queryInterface.removeIndex("refunds", "refunds_provider_refund_id_uniq").catch(() => {});
        await queryInterface.removeIndex("orders", "orders_current_payment_attempt_idx").catch(() => {});
        await queryInterface.removeColumn("orders", "current_payment_attempt_id").catch(() => {});
        await queryInterface.removeColumn("orders", "refund_status").catch(() => {});
        await queryInterface.removeColumn("orders", "retry_allowed").catch(() => {});
    },
};
