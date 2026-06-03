"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("cost_entries", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            cost_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            category: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            warehouse_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "warehouses", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            related_order_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "orders", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            reference_type: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            reference_no: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            amount_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "active",
            },
            created_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
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

        await queryInterface.addIndex("cost_entries", ["cost_date"], {
            name: "cost_entries_cost_date_idx",
        });

        await queryInterface.addIndex("cost_entries", ["category"], {
            name: "cost_entries_category_idx",
        });

        await queryInterface.addIndex("cost_entries", ["warehouse_id"], {
            name: "cost_entries_warehouse_idx",
        });

        await queryInterface.createTable("procurement_costs", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            delivery_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            warehouse_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "warehouses", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "products", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            },
            product_pack_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "product_packs", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            product_name: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            pack_label: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            ordered_quantity: {
                type: Sequelize.DECIMAL(10, 3),
                allowNull: false,
            },
            unit_cost_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            total_cost_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
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

        await queryInterface.addIndex(
            "procurement_costs",
            ["delivery_date", "warehouse_id"],
            { name: "procurement_costs_delivery_warehouse_idx" }
        );

        await queryInterface.addIndex(
            "procurement_costs",
            ["delivery_date", "product_id", "product_pack_id"],
            {
                name: "procurement_costs_delivery_product_pack_uniq",
                unique: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable("procurement_costs");
        await queryInterface.dropTable("cost_entries");
    },
};