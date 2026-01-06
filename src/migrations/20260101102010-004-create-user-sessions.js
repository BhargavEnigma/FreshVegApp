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

        await queryInterface.createTable("user_sessions", {
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
            refresh_token_hash: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            device_id: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            device_name: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            ip_address: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            is_revoked: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            revoked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
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

        await safeAddIndex("user_sessions", ["user_id"], {
            name: "user_sessions_user_id_idx",
        });

        await safeAddIndex("user_sessions", ["refresh_token_hash"], {
            name: "user_sessions_token_hash_idx",
        });

        await safeAddIndex("user_sessions", ["user_id", "is_revoked", "expires_at"], {
            name: "user_sessions_active_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("user_sessions");
    },
};
