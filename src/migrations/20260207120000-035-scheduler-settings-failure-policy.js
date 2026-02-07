"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add failure-policy + pause/audit fields to scheduler_settings.
        // Using additive migration to keep existing data.

        await queryInterface.addColumn("scheduler_settings", "consecutive_failures", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await queryInterface.addColumn("scheduler_settings", "max_consecutive_failures", {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 3,
        });

        await queryInterface.addColumn("scheduler_settings", "paused_at", {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn("scheduler_settings", "pause_reason", {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn("scheduler_settings", "last_error_message", {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn("scheduler_settings", "last_failed_at", {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn("scheduler_settings", "last_failed_at");
        await queryInterface.removeColumn("scheduler_settings", "last_error_message");
        await queryInterface.removeColumn("scheduler_settings", "pause_reason");
        await queryInterface.removeColumn("scheduler_settings", "paused_at");
        await queryInterface.removeColumn("scheduler_settings", "max_consecutive_failures");
        await queryInterface.removeColumn("scheduler_settings", "consecutive_failures");
    },
};
