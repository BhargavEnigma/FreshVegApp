"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("delivery_slots", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            name: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            start_time: {
                type: Sequelize.TIME,
                allowNull: false,
            },
            end_time: {
                type: Sequelize.TIME,
                allowNull: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
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

        await queryInterface.addIndex("delivery_slots", ["is_active"], {
            name: "delivery_slots_active_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("delivery_slots");
    },
};
