"use strict";

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

        await queryInterface.createTable("user_roles", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            role: {
                type: Sequelize.STRING(40),
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        await safeAddIndex("user_roles", ["user_id"], {
            name: "user_roles_user_id_idx",
        });

        await safeAddIndex("user_roles", ["role"], {
            name: "user_roles_role_idx",
        });

        await queryInterface.addConstraint("user_roles", {
            fields: ["user_id", "role"],
            type: "unique",
            name: "user_roles_user_id_role_uniq",
        });

        // Optional: seed all existing users as "customer"
        await safeQuery(`
            INSERT INTO user_roles (user_id, role)
            SELECT id, 'customer' FROM users
            ON CONFLICT (user_id, role) DO NOTHING
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("user_roles");
    },
};
