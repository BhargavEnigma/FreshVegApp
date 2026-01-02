"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("payments", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            order_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "orders", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            method: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            amount_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            provider: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            provider_payment_id: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            provider_payload: {
                type: Sequelize.JSONB,
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

        await queryInterface.addIndex("payments", ["order_id"], { name: "payments_order_idx" });
        await queryInterface.addIndex("payments", ["status"], { name: "payments_status_idx" });

        await queryInterface.sequelize.query(`
            ALTER TABLE payments
            ADD CONSTRAINT payments_method_check
            CHECK (method IN ('cod','upi'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE payments
            ADD CONSTRAINT payments_status_check
            CHECK (status IN ('pending','paid','failed','refunded'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE payments
            ADD CONSTRAINT payments_amount_paise_check
            CHECK (amount_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("payments");
    },
};
