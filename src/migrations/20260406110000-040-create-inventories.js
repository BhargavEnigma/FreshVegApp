"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableExists = await queryInterface.describeTable("inventories").then(() => true).catch(() => false);

        if (!tableExists) {
            await queryInterface.createTable("inventories", {
                id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                warehouse_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: "warehouses", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                product_pack_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: "product_packs", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                available_qty: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                reserved_qty: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.fn("now"),
                },
                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.fn("now"),
                },
            });
        }

        const [results] = await queryInterface.sequelize.query(`
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname = 'inventories_wh_pack_uniq'
            LIMIT 1;
        `);

        if (!results.length) {
            await queryInterface.addIndex("inventories", ["warehouse_id", "product_pack_id"], {
                name: "inventories_wh_pack_uniq",
                unique: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS "inventories_wh_pack_uniq";
        `);

        await queryInterface.dropTable("inventories").catch(() => null);
    },
};