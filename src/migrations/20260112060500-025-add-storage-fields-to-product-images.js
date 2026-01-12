"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const safeAddColumn = async (table, column, spec) => {
            try {
                await queryInterface.addColumn(table, column, spec);
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

        await safeAddColumn("product_images", "storage_provider", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await safeAddColumn("product_images", "storage_path", {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn("product_images", "storage_provider");
        } catch (_) {}

        try {
            await queryInterface.removeColumn("product_images", "storage_path");
        } catch (_) {}
    },
};
