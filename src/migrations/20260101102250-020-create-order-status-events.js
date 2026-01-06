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

        await queryInterface.createTable("order_status_events", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            order_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "orders", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            from_status: {
                type: Sequelize.STRING(40),
                allowNull: true,
            },
            to_status: {
                type: Sequelize.STRING(40),
                allowNull: false,
            },
            actor_user_id: {
                // who changed status (admin/warehouse_manager)
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "users", key: "id" },
                onDelete: "SET NULL",
                onUpdate: "CASCADE",
            },
            note: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            meta: {
                // JSON for extra info (gateway, webhook id, etc)
                type: Sequelize.JSONB,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        await safeAddIndex("order_status_events", ["order_id", "created_at"], {
            name: "order_status_events_order_id_created_at_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("order_status_events");
    },
};
