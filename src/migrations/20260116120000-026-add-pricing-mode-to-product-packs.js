"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='product_packs' AND column_name='pricing_mode'
                ) THEN
                    ALTER TABLE product_packs
                    ADD COLUMN pricing_mode varchar(20) NOT NULL DEFAULT 'dynamic';
                END IF;
            END$$;
        `);

        // Optional: constraint
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'product_packs_pricing_mode_check'
                ) THEN
                    ALTER TABLE product_packs
                    ADD CONSTRAINT product_packs_pricing_mode_check
                    CHECK (pricing_mode IN ('dynamic', 'manual'));
                END IF;
            END$$;
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE product_packs
            DROP COLUMN IF EXISTS pricing_mode;
        `);
    },
};
