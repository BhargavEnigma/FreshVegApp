"use strict";

/**
 * Deals of the Day (future-proof)
 * - deals: one row per date (IST) with optional time window
 * - deal_items: pack-level pricing rules
 *
 * Also adds audit columns to order_items so we can persist applied deal pricing.
 */

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable("deals", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },

            name: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Deals of the Day" },
            description: { type: Sequelize.TEXT, allowNull: true },

            deal_date: { type: Sequelize.DATEONLY, allowNull: false },
            starts_at: { type: Sequelize.DATE, allowNull: true },
            ends_at: { type: Sequelize.DATE, allowNull: true },

            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });

        await queryInterface.addIndex("deals", ["deal_date", "is_active", "priority"], {
            name: "deals_date_active_idx",
        });

        await queryInterface.createTable("deal_items", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },

            deal_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "deals", key: "id" },
                onDelete: "CASCADE",
            },

            product_pack_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "product_packs", key: "id" },
                onDelete: "RESTRICT",
            },

            pricing_type: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "fixed_price",
            },

            deal_price_paise: { type: Sequelize.INTEGER, allowNull: true },
            discount_bps: { type: Sequelize.INTEGER, allowNull: true },
            discount_paise: { type: Sequelize.INTEGER, allowNull: true },
            max_qty_per_order: { type: Sequelize.INTEGER, allowNull: true },

            sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });

        await queryInterface.addIndex("deal_items", ["deal_id"], { name: "deal_items_deal_idx" });
        await queryInterface.addIndex("deal_items", ["product_pack_id"], { name: "deal_items_pack_idx" });
        await queryInterface.addIndex("deal_items", ["deal_id", "product_pack_id"], {
            name: "deal_items_deal_pack_uniq",
            unique: true,
        });

        // --- Order items audit columns ---
        // Keep existing columns intact; these are optional and won't break current flows.
        await queryInterface.addColumn("order_items", "original_unit_price_paise", {
            type: Sequelize.INTEGER,
            allowNull: true,
        });
        await queryInterface.addColumn("order_items", "deal_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "deals", key: "id" },
            onDelete: "SET NULL",
        });
        await queryInterface.addColumn("order_items", "deal_item_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "deal_items", key: "id" },
            onDelete: "SET NULL",
        });
        await queryInterface.addColumn("order_items", "deal_price_paise", {
            type: Sequelize.INTEGER,
            allowNull: true,
        });
        await queryInterface.addColumn("order_items", "line_discount_paise", {
            type: Sequelize.INTEGER,
            allowNull: true,
        });

        await queryInterface.addIndex("order_items", ["deal_id"], { name: "order_items_deal_idx" });
    },

    down: async (queryInterface) => {
        await queryInterface.removeIndex("order_items", "order_items_deal_idx");
        await queryInterface.removeColumn("order_items", "line_discount_paise");
        await queryInterface.removeColumn("order_items", "deal_price_paise");
        await queryInterface.removeColumn("order_items", "deal_item_id");
        await queryInterface.removeColumn("order_items", "deal_id");
        await queryInterface.removeColumn("order_items", "original_unit_price_paise");

        await queryInterface.dropTable("deal_items");
        await queryInterface.dropTable("deals");
    },
};
