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

        // 1) Add product_pack_id column (nullable for backfill)
        await queryInterface.addColumn("cart_items", "product_pack_id", {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "product_packs", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        });

        // 2) Backfill product_pack_id for existing rows using default active pack for product
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

        // 3) If any rows still NULL, it means product has no active pack -> fail
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

        // 4) Drop old unique index (cart_id, product_id) because it blocks multiple packs per product
        // If index was not present for some reason, ignore safely
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_product");
        } catch (e) {
            // ignore if missing
        }

        // 5) Make product_pack_id NOT NULL
        await queryInterface.changeColumn("cart_items", "product_pack_id", {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "product_packs", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        });

        // 6) Add correct unique index: (cart_id, product_pack_id)
        await safeAddIndex("cart_items", ["cart_id", "product_pack_id"], {
            unique: true,
            name: "cart_items_unique_cart_pack",
        });

        // 7) Add index on product_pack_id (useful for joins)
        await safeAddIndex("cart_items", ["product_pack_id"], {
            name: "cart_items_pack_id_idx",
        });

        // (Optional) Add a check to ensure product_id matches pack.product_id
        // This keeps denormalized product_id consistent.
        // If you don't want this complexity, skip it.
        await safeQuery(`
            ALTER TABLE cart_items
            ADD CONSTRAINT cart_items_product_pack_product_match_check
            CHECK (
                product_id = (
                    SELECT pp.product_id
                    FROM product_packs pp
                    WHERE pp.id = product_pack_id
                )
            );
        `);
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_pack_id_idx");
        } catch (e) {}
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_pack");
        } catch (e) {}

        // Remove check constraint if created
        try {
            await queryInterface.sequelize.query(`
                ALTER TABLE cart_items
                DROP CONSTRAINT IF EXISTS cart_items_product_pack_product_match_check;
            `);
        } catch (e) {}

        // Make column nullable then drop it
        try {
            await queryInterface.changeColumn("cart_items", "product_pack_id", {
                type: Sequelize.UUID,
                allowNull: true,
            });
        } catch (e) {}

        try {
            await queryInterface.removeColumn("cart_items", "product_pack_id");
        } catch (e) {}

        // Restore old unique index (for rollback completeness)
        try {
            await queryInterface.addIndex("cart_items", ["cart_id", "product_id"], {
                unique: true,
                name: "cart_items_unique_cart_product",
            });
        } catch (e) {}
    },
};