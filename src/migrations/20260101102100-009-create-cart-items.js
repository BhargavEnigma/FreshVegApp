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

        // STEP 1: First, ensure product_id column exists (it should, but just in case)
        // If cart_items is being created fresh, you need to create the table first
        // For an existing table, skip to STEP 2

        // STEP 2: Add the product_pack_id column as nullable
        await queryInterface.addColumn("cart_items", "product_pack_id", {
            type: Sequelize.UUID,
            allowNull: true,
        });

        // STEP 3: Add a foreign key constraint separately (after column exists)
        // First check if we need to add the constraint
        try {
            await queryInterface.addConstraint("cart_items", {
                fields: ["product_pack_id"],
                type: "foreign key",
                name: "cart_items_product_pack_id_fkey",
                references: {
                    table: "product_packs",
                    field: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            });
        } catch (e) {
            // Constraint might already exist
            const msg = String(e?.message || "");
            if (!msg.includes("already exists")) {
                throw e;
            }
        }

        // STEP 4: Update existing rows - FIXED VERSION
        // This query assumes product_id column exists
        // Only run this if there are existing rows AND product_packs exist
        const [tableCheck] = await queryInterface.sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'cart_items'
            ) as exists;
        `);

        if (tableCheck?.[0]?.exists) {
            // Only try to update if there are rows
            const [countResult] = await queryInterface.sequelize.query(`
                SELECT COUNT(*) as cnt FROM cart_items;
            `);
            
            if (countResult?.[0]?.cnt > 0) {
                try {
                    await queryInterface.sequelize.query(`
                        UPDATE cart_items ci
                        SET product_pack_id = sub.pack_id
                        FROM (
                            SELECT 
                                ci2.id AS cart_item_id,
                                pp.id AS pack_id
                            FROM cart_items ci2
                            CROSS JOIN LATERAL (
                                SELECT ppx.id
                                FROM product_packs ppx
                                WHERE ppx.product_id = ci2.product_id
                                  AND ppx.is_active = true
                                ORDER BY ppx.sort_order ASC, ppx.created_at ASC
                                LIMIT 1
                            ) pp
                            WHERE ci2.product_pack_id IS NULL
                        ) sub
                        WHERE ci.id = sub.cart_item_id;
                    `);
                } catch (e) {
                    console.log("Update skipped or failed:", e.message);
                }
            }
        }

        // STEP 5: Check for NULL values (only if we expect data)
        const [rows] = await queryInterface.sequelize.query(`
            SELECT COUNT(*)::int AS cnt
            FROM cart_items
            WHERE product_pack_id IS NULL;
        `);

        if (rows?.[0]?.cnt > 0) {
            // Instead of throwing error, either:
            // Option A: Allow NULLs (change column to nullable)
            console.log(`Warning: ${rows[0].cnt} cart_items have NULL product_pack_id`);
            
            // Option B: Set a default pack for remaining NULLs
            await queryInterface.sequelize.query(`
                UPDATE cart_items ci
                SET product_pack_id = (
                    SELECT id FROM product_packs 
                    WHERE product_id = ci.product_id AND is_active = true 
                    ORDER BY sort_order ASC, created_at ASC 
                    LIMIT 1
                )
                WHERE product_pack_id IS NULL;
            `);
        }

        // STEP 6: Change column to NOT NULL (only if no NULLs remain)
        const [finalCheck] = await queryInterface.sequelize.query(`
            SELECT COUNT(*)::int AS cnt
            FROM cart_items
            WHERE product_pack_id IS NULL;
        `);

        if (finalCheck?.[0]?.cnt === 0) {
            await queryInterface.changeColumn("cart_items", "product_pack_id", {
                type: Sequelize.UUID,
                allowNull: false,
            });
        } else {
            console.log("Keeping product_pack_id as nullable due to existing NULL values");
        }

        // STEP 7: Handle indexes
        // Remove old unique constraint if it exists
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_product");
        } catch (e) {
            // Index might not exist
        }

        // Add new unique constraint
        await safeAddIndex("cart_items", ["cart_id", "product_pack_id"], {
            unique: true,
            name: "cart_items_unique_cart_pack",
        });

        // Add index on product_pack_id
        await safeAddIndex("cart_items", ["product_pack_id"], {
            name: "cart_items_pack_id_idx",
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_pack_id_idx");
        } catch (e) {}
        try {
            await queryInterface.removeIndex("cart_items", "cart_items_unique_cart_pack");
        } catch (e) {}

        // Remove foreign key constraint
        try {
            await queryInterface.removeConstraint("cart_items", "cart_items_product_pack_id_fkey");
        } catch (e) {}

        // Remove column
        try {
            await queryInterface.removeColumn("cart_items", "product_pack_id");
        } catch (e) {}

        // Restore old unique constraint
        try {
            await queryInterface.addIndex("cart_items", ["cart_id", "product_id"], {
                unique: true,
                name: "cart_items_unique_cart_product",
            });
        } catch (e) {}
    },
};