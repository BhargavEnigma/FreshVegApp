"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const safeAddColumn = async (table, column, definition) => {
            try {
                await queryInterface.addColumn(table, column, definition);
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

        await safeAddColumn("categories", "image_url", { type: Sequelize.TEXT, allowNull: true });
        await safeAddColumn("categories", "storage_provider", { type: Sequelize.TEXT, allowNull: true });
        await safeAddColumn("categories", "storage_path", { type: Sequelize.TEXT, allowNull: true });
    },

    async down(queryInterface) {
        try { await queryInterface.removeColumn("categories", "storage_path"); } catch (_) {}
        try { await queryInterface.removeColumn("categories", "storage_provider"); } catch (_) {}
        try { await queryInterface.removeColumn("categories", "image_url"); } catch (_) {}
    },
};
