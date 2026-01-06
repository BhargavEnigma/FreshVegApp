"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("order_items");

        if (!table.product_pack_id) {
            await queryInterface.addColumn("order_items", "product_pack_id", {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "product_packs", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            });
        }

        if (!table.pack_label) {
            await queryInterface.addColumn("order_items", "pack_label", {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }

        await queryInterface.sequelize.query(
            "CREATE INDEX IF NOT EXISTS order_items_pack_idx ON order_items (product_pack_id);"
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS order_items_pack_idx;");

        const table = await queryInterface.describeTable("order_items");
        if (table.pack_label) {
            await queryInterface.removeColumn("order_items", "pack_label");
        }
        if (table.product_pack_id) {
            await queryInterface.removeColumn("order_items", "product_pack_id");
        }
    },
};
