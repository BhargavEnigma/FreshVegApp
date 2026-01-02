"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("cart_items", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            cart_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "carts", key: "id" },
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
            quantity: {
                type: Sequelize.DECIMAL(10, 3),
                allowNull: false,
            },
            price_paise: {
                type: Sequelize.INTEGER,
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

        await queryInterface.addIndex("cart_items", ["cart_id"], { name: "cart_items_cart_idx" });

        await queryInterface.addIndex("cart_items", ["cart_id", "product_id"], {
            unique: true,
            name: "cart_items_unique_cart_product",
        });

        await queryInterface.sequelize.query(`
            ALTER TABLE cart_items
            ADD CONSTRAINT cart_items_quantity_check
            CHECK (quantity >= 0.001);
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE cart_items
            ADD CONSTRAINT cart_items_price_paise_check
            CHECK (price_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("cart_items");
    },
};
