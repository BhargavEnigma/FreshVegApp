"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const safeAddColumn = async (table, column, definition) => {
            try {
                await queryInterface.addColumn(table, column, definition);
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

        await safeAddColumn("orders", "delivery_partner_user_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });

        await safeAddColumn("orders", "delivery_assigned_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivery_assigned_by_user_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });

        await safeAddColumn("orders", "picked_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddColumn("orders", "out_for_delivery_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivered_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivery_failed_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivery_attempt_count", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await safeAddColumn("orders", "delivery_failure_reason", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivery_notes", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await safeAddColumn("orders", "delivery_proof_image_url", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await safeAddColumn("orders", "customer_delivery_otp_hash", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await safeAddColumn("orders", "customer_delivery_otp_expires_at", {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await safeAddIndex("orders", ["delivery_partner_user_id"], {
            name: "orders_delivery_partner_idx",
        });

        await safeAddIndex("orders", ["warehouse_id", "delivery_partner_user_id", "delivery_date"], {
            name: "orders_wh_delivery_partner_delivery_date_idx",
        });

        await safeQuery(`
            ALTER TABLE orders
            DROP CONSTRAINT IF EXISTS orders_status_check;
        `);

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
                    'delivery_failed',
                    'cancelled',
                    'refunded'
                )
            );
        `);

        await safeQuery(`
            ALTER TABLE orders
            DROP CONSTRAINT IF EXISTS orders_delivery_attempt_count_check;
        `);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_delivery_attempt_count_check
            CHECK (delivery_attempt_count >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex("orders", "orders_wh_delivery_partner_delivery_date_idx").catch(() => {});
        await queryInterface.removeIndex("orders", "orders_delivery_partner_idx").catch(() => {});

        await queryInterface.removeColumn("orders", "customer_delivery_otp_expires_at").catch(() => {});
        await queryInterface.removeColumn("orders", "customer_delivery_otp_hash").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_proof_image_url").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_notes").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_failure_reason").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_attempt_count").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_failed_at").catch(() => {});
        await queryInterface.removeColumn("orders", "delivered_at").catch(() => {});
        await queryInterface.removeColumn("orders", "out_for_delivery_at").catch(() => {});
        await queryInterface.removeColumn("orders", "picked_at").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_assigned_by_user_id").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_assigned_at").catch(() => {});
        await queryInterface.removeColumn("orders", "delivery_partner_user_id").catch(() => {});

        await queryInterface.sequelize.query(`
            ALTER TABLE orders
            DROP CONSTRAINT IF EXISTS orders_status_check;
        `);

        await queryInterface.sequelize.query(`
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
        `).catch(() => {});
    },
};