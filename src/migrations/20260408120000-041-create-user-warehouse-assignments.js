"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("user_warehouse_assignments", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "users",
                    key: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            warehouse_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "warehouses",
                    key: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        await queryInterface.addConstraint("user_warehouse_assignments", {
            fields: ["user_id", "warehouse_id"],
            type: "unique",
            name: "user_warehouse_assignments_user_warehouse_uniq",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("user_warehouse_assignments");
    },
};