"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1) Create table if it doesn't exist (fresh DB)
        await queryInterface.createTable(
            "product_packs",
            {
                id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                product_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: "products", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                label: {
                    type: Sequelize.STRING(40),
                    allowNull: false,
                },
                base_quantity: {
                    type: Sequelize.DECIMAL(10, 3),
                    allowNull: false,
                },
                base_unit: {
                    type: Sequelize.STRING(10),
                    allowNull: false,
                },
                mrp_paise: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                },
                selling_price_paise: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                sort_order: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                is_active: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
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
            },
            { ifNotExists: true }
        );

        // 2) Repair existing table (if it was created earlier with old column names)
        //    - rename price_paise/price -> selling_price_paise
        //    - rename mrp -> mrp_paise
        //    - add missing columns if needed
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                -- selling_price_paise
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='selling_price_paise'
                ) THEN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='product_packs' AND column_name='price_paise'
                    ) THEN
                        ALTER TABLE product_packs RENAME COLUMN price_paise TO selling_price_paise;
                    ELSIF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='product_packs' AND column_name='price'
                    ) THEN
                        ALTER TABLE product_packs RENAME COLUMN price TO selling_price_paise;
                    ELSE
                        ALTER TABLE product_packs ADD COLUMN selling_price_paise integer;
                    END IF;
                END IF;

                -- mrp_paise
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='mrp_paise'
                ) THEN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='product_packs' AND column_name='mrp'
                    ) THEN
                        ALTER TABLE product_packs RENAME COLUMN mrp TO mrp_paise;
                    ELSE
                        ALTER TABLE product_packs ADD COLUMN mrp_paise integer;
                    END IF;
                END IF;

                -- base_quantity
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='base_quantity'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN base_quantity numeric(10,3);
                    UPDATE product_packs SET base_quantity = 1.000 WHERE base_quantity IS NULL;
                    ALTER TABLE product_packs ALTER COLUMN base_quantity SET NOT NULL;
                END IF;

                -- base_unit
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='base_unit'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN base_unit text;
                    UPDATE product_packs SET base_unit = 'unit' WHERE base_unit IS NULL;
                    ALTER TABLE product_packs ALTER COLUMN base_unit SET NOT NULL;
                END IF;

                -- sort_order
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='sort_order'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
                END IF;

                -- is_active
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='is_active'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN is_active boolean NOT NULL DEFAULT true;
                END IF;

                -- created_at / updated_at
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='created_at'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='updated_at'
                ) THEN
                    ALTER TABLE product_packs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
                END IF;

                -- Ensure selling_price_paise has values and is NOT NULL
                UPDATE product_packs SET selling_price_paise = 0 WHERE selling_price_paise IS NULL;
                ALTER TABLE product_packs ALTER COLUMN selling_price_paise SET NOT NULL;
            END$$;
        `);

        // 3) CHECK constraint (idempotent)
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'product_packs_price_check'
                ) THEN
                    ALTER TABLE product_packs
                    ADD CONSTRAINT product_packs_price_check
                    CHECK (
                        selling_price_paise >= 0
                        AND (mrp_paise IS NULL OR mrp_paise >= 0)
                    );
                END IF;
            END$$;
        `);

        // 4) Indexes (safe: drop name conflicts first, then create)
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'product_packs_product_label_uniq'
                ) THEN
                    ALTER TABLE product_packs DROP CONSTRAINT product_packs_product_label_uniq;
                END IF;
            END$$;

            DROP INDEX IF EXISTS product_packs_product_id_idx;
            DROP INDEX IF EXISTS product_packs_product_id_is_active_idx;
            DROP INDEX IF EXISTS product_packs_product_label_uniq;
        `);

        await queryInterface.addIndex("product_packs", ["product_id"], {
            name: "product_packs_product_id_idx",
        });

        await queryInterface.addIndex("product_packs", ["product_id", "is_active"], {
            name: "product_packs_product_id_is_active_idx",
        });

        await queryInterface.addIndex("product_packs", ["product_id", "label"], {
            name: "product_packs_product_label_uniq",
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("product_packs");
    },
};
