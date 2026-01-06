"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("orders");

        if (!table.warehouse_id) {
            await queryInterface.addColumn("orders", "warehouse_id", {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: "warehouses", key: "id" },
                onDelete: "RESTRICT",
                onUpdate: "CASCADE",
            });
        }

        // Helpful index for ops filters
        try {
            await queryInterface.sequelize.query(
                "CREATE INDEX IF NOT EXISTS orders_warehouse_id_idx ON orders (warehouse_id);"
            );
        } catch (e) {
            // ignore
        }
    },

    async down(queryInterface) {
        try {
            await queryInterface.sequelize.query("DROP INDEX IF EXISTS orders_warehouse_id_idx;");
        } catch (e) {
            // ignore
        }

        const table = await queryInterface.describeTable("orders");
        if (table.warehouse_id) {
            await queryInterface.removeColumn("orders", "warehouse_id");
        }
    },
};
