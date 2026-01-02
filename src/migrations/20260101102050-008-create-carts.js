"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("carts", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "active",
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

        await queryInterface.addIndex("carts", ["user_id", "status"], {
            name: "carts_user_status_idx",
        });

        await queryInterface.sequelize.query(`
            ALTER TABLE carts
            ADD CONSTRAINT carts_status_check
            CHECK (status IN ('active', 'checked_out'));
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("carts");
    },
};
