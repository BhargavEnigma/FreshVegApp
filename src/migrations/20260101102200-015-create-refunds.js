"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("refunds", {
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
            payment_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "payments", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            amount_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            provider_refund_id: {
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

        await queryInterface.addIndex("refunds", ["order_id"], { name: "refunds_order_idx" });

        await queryInterface.sequelize.query(`
            ALTER TABLE refunds
            ADD CONSTRAINT refunds_status_check
            CHECK (status IN ('initiated','succeeded','failed'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE refunds
            ADD CONSTRAINT refunds_amount_paise_check
            CHECK (amount_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("refunds");
    },
};
