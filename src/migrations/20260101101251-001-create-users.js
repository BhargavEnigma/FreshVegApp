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
        await safeAddIndex("users", ["status"], { name: "users_status_idx" });

        // DB-level CHECK constraint (Postgres)
        await safeQuery(`
            ALTER TABLE users
            ADD CONSTRAINT users_status_check
            CHECK (status IN ('active', 'blocked'));
        `);
    },
    
    async down(queryInterface) {
        await queryInterface.dropTable("users");
    },
};
