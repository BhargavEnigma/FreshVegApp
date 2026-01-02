"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("order_status_history", {
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
            from_status: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            to_status: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            changed_by: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            note: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await queryInterface.addIndex("order_status_history", ["order_id", "created_at"], {
            name: "order_status_history_order_created_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("order_status_history");
    },
};
