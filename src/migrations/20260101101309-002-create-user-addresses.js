"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("user_addresses", {
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
            label: { type: Sequelize.TEXT, allowNull: true },
            name: { type: Sequelize.TEXT, allowNull: true },
            phone: { type: Sequelize.TEXT, allowNull: true },

            address_line1: { type: Sequelize.TEXT, allowNull: false },
            address_line2: { type: Sequelize.TEXT, allowNull: true },
            landmark: { type: Sequelize.TEXT, allowNull: true },
            area: { type: Sequelize.TEXT, allowNull: true },

            city: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Ahmedabad" },
            state: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Gujarat" },
            pincode: { type: Sequelize.TEXT, allowNull: false },

            lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
            lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },

            is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("now()") },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("now()") },
        });

        // Indexes
        await queryInterface.addIndex("user_addresses", ["user_id"], { name: "user_addresses_user_id_idx" });
        await queryInterface.addIndex("user_addresses", ["user_id", "is_default"], { name: "user_addresses_default_idx" });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("user_addresses");
    },
};