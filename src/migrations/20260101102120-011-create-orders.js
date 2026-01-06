"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {

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

        await queryInterface.createTable("orders", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            order_number: {
                type: Sequelize.TEXT,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            },
            address_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "user_addresses", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            },
            delivery_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            delivery_slot_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "delivery_slots", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "placed",
            },
            subtotal_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            delivery_fee_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            discount_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            total_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            payment_status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "pending",
            },
            payment_method: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "cod",
            },
            is_locked: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            locked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            cancelled_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            cancellation_reason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await safeAddIndex("orders", ["user_id", "created_at"], {
            name: "orders_user_created_idx",
        });
        await safeAddIndex("orders", ["status"], { name: "orders_status_idx" });
        await safeAddIndex("orders", ["delivery_date"], { name: "orders_delivery_date_idx" });
        await safeAddIndex("orders", ["is_locked"], { name: "orders_locked_idx" });

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_status_check
            CHECK (status IN ('placed','confirmed','packed','out_for_delivery','delivered','cancelled','refunded'));
        `);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_payment_status_check
            CHECK (payment_status IN ('pending','paid','failed','refunded'));
        `);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_payment_method_check
            CHECK (payment_method IN ('cod','upi'));
        `);

        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_subtotal_paise_check CHECK (subtotal_paise >= 0);
        `);
        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_delivery_fee_paise_check CHECK (delivery_fee_paise >= 0);
        `);
        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_discount_paise_check CHECK (discount_paise >= 0);
        `);
        await safeQuery(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_total_paise_check CHECK (total_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("orders");
    },
};
