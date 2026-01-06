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

        await queryInterface.createTable("order_status_history", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            order_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "orders", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            from_status: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            to_status: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            changed_by: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            note: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await safeAddIndex("order_status_history", ["order_id", "created_at"], {
            name: "order_status_history_order_created_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("order_status_history");
    },
};
