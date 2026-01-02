"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("users", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            phone: {
                type: Sequelize.TEXT,
                allowNull: false,
                unique: true,
            },
            full_name: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            email: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "active",
            },
            last_login_at: {
                type: Sequelize.DATE,
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

        // Indexes
        await queryInterface.addIndex("users", ["status"], { name: "users_status_idx" });

        // DB-level CHECK constraint (Postgres)
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            ADD CONSTRAINT users_status_check
            CHECK (status IN ('active', 'blocked'));
        `);
    },
    
    async down(queryInterface) {
        await queryInterface.dropTable("users");
    },
};
