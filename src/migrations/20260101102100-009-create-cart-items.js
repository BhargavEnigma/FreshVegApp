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

        await queryInterface.addColumn("cart_items", "product_pack_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "product_packs", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        });

        await queryInterface.sequelize.query(`
            UPDATE cart_items ci
            SET product_pack_id = sub.pack_id
            FROM (
                SELECT
                    ci2.id AS cart_item_id,
                    pp.id AS pack_id
                FROM cart_items ci2
                JOIN LATERAL (
                    SELECT ppx.id
                    FROM product_packs ppx
                    WHERE ppx.product_id = ci2.product_id
                      AND ppx.is_active = true
                    ORDER BY ppx.sort_order ASC, ppx.created_at ASC
                    LIMIT 1
                ) pp ON true
                WHERE ci2.product_pack_id IS NULL
            ) sub
            WHERE ci.id = sub.cart_item_id;
        `);

        const [rows] = await queryInterface.sequelize.query(`
            SELECT COUNT(*)::int AS cnt
            FROM cart_items
            WHERE product_pack_id IS NULL;
        `);

        if (rows?.[0]?.cnt > 0) {
            throw new Error(
                "Migration failed: Some cart_items still have NULL product_pack_id. " +
                "Fix data: ensure every product referenced by cart_items has at least 1 active product_pack."
            );
        }

        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_product");
        } catch (e) {
        }

        await queryInterface.changeColumn("cart_items", "product_pack_id", {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "product_packs", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        });

        await safeAddIndex("cart_items", ["cart_id", "product_pack_id"], {
            unique: true,
            name: "cart_items_unique_cart_pack",
        });

        await safeAddIndex("cart_items", ["product_pack_id"], {
            name: "cart_items_pack_id_idx",
        });

        // NOTE:
        // Do not add a CHECK with a subquery here. PostgreSQL does not allow subqueries
        // inside CHECK constraints, and it will break fresh database setup.
        // Consistency is enforced at application level by validating that product_pack_id
        // belongs to product_id before writes.
    },

    async down(queryInterface, Sequelize) {
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_pack_id_idx");
        } catch (e) {}
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_pack");
        } catch (e) {}

        try {
            await queryInterface.changeColumn("cart_items", "product_pack_id", {
                type: Sequelize.UUID,
                allowNull: true,
            });
        } catch (e) {}

        try {
            await queryInterface.removeColumn("cart_items", "product_pack_id");
        } catch (e) {}

        try {
            await queryInterface.addIndex("cart_items", ["cart_id", "product_id"], {
                unique: true,
                name: "cart_items_unique_cart_product",
            });
        } catch (e) {}
    },
};