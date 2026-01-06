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

        await queryInterface.createTable("notifications", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "users", key: "id" },
                onDelete: "SET NULL",
                onUpdate: "CASCADE",
            },
            channel: {
                // "email" | "push"
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            template: {
                // "order_placed", "order_locked", etc.
                type: Sequelize.STRING(60),
                allowNull: false,
            },
            payload: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            status: {
                // "queued" | "sent" | "failed"
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: "queued",
            },
            attempt_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            last_error: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            scheduled_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            sent_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        await safeAddIndex("notifications", ["status", "scheduled_at"], {
            name: "notifications_status_scheduled_at_idx",
        });

        await safeAddIndex("notifications", ["user_id"], {
            name: "notifications_user_id_idx",
        });

        await safeQuery(`
            ALTER TABLE notifications
            ADD CONSTRAINT notifications_status_chk
            CHECK (status IN ('queued','sent','failed'))
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("notifications");
    },
};
