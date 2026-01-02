"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
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

        await queryInterface.addIndex("order_items", ["order_id"], {
            name: "order_items_order_idx",
        });

        await queryInterface.sequelize.query(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_quantity_check CHECK (quantity >= 0.001);
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_unit_price_paise_check CHECK (unit_price_paise >= 0);
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_line_total_paise_check CHECK (line_total_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("order_items");
    },
};
