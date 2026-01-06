"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("users");

        if (!table.fcm_token) {
            await queryInterface.addColumn("users", "fcm_token", {
                type: Sequelize.STRING(500),
                allowNull: true,
            });
        }

        // index is optional; keep idempotent
        try {
            await queryInterface.sequelize.query(
                'CREATE INDEX IF NOT EXISTS users_fcm_token_idx ON users (fcm_token);'
            );
        } catch (e) {
            // ignore
        }
    },

    async down(queryInterface) {
        try {
            await queryInterface.sequelize.query("DROP INDEX IF EXISTS users_fcm_token_idx;");
        } catch (e) {
            // ignore
        }

        const table = await queryInterface.describeTable("users");
        if (table.fcm_token) {
            await queryInterface.removeColumn("users", "fcm_token");
        }
    },
};
