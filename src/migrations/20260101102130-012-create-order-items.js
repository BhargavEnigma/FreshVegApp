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

        await queryInterface.createTable("order_items", {
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
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "products", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            },
            product_name: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            unit: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            quantity: {
                type: Sequelize.DECIMAL(10, 3),
                allowNull: false,
            },
            unit_price_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            line_total_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await safeAddIndex("order_items", ["order_id"], {
            name: "order_items_order_idx",
        });

        await safeQuery(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_quantity_check CHECK (quantity >= 0.001);
        `);
        await safeQuery(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_unit_price_paise_check CHECK (unit_price_paise >= 0);
        `);
        await safeQuery(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_line_total_paise_check CHECK (line_total_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("order_items");
    },
};
