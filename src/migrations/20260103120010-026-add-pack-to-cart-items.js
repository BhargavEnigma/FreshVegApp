"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("cart_items");

        if (!table.product_pack_id) {
            await queryInterface.addColumn("cart_items", "product_pack_id", {
                type: Sequelize.UUID,
                allowNull: true, // keep nullable for existing rows; app-level validation should enforce new carts
                references: { model: "product_packs", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            });
        }

        // Replace uniqueness: (cart_id, product_id) -> (cart_id, product_pack_id)
        // Drop old index if exists
        await queryInterface.sequelize.query(
            "DROP INDEX IF EXISTS cart_items_unique_cart_product;"
        );

        // Create new unique index
        await queryInterface.sequelize.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS cart_items_unique_cart_pack ON cart_items (cart_id, product_pack_id);"
        );

        await queryInterface.sequelize.query(
            "CREATE INDEX IF NOT EXISTS cart_items_pack_idx ON cart_items (product_pack_id);"
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS cart_items_pack_idx;");
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS cart_items_unique_cart_pack;");

        // Recreate old index (optional)
        await queryInterface.sequelize.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS cart_items_unique_cart_product ON cart_items (cart_id, product_id);"
        );

        const table = await queryInterface.describeTable("cart_items");
        if (table.product_pack_id) {
            await queryInterface.removeColumn("cart_items", "product_pack_id");
        }
    },
};
