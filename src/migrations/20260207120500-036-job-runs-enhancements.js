"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add fields required for observability & auditability.
        await queryInterface.addColumn("job_runs", "scheduled_for", {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn("job_runs", "error_message", {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn("job_runs", "trigger_source", {
            // "cron" | "manual" (or other future values)
            type: Sequelize.STRING(20),
            allowNull: true,
            defaultValue: null,
        });

        // Helpful index for history queries
        await queryInterface.addIndex("job_runs", ["job_name", "started_at"], {
            name: "job_runs_job_name_started_at_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex("job_runs", "job_runs_job_name_started_at_idx");
        await queryInterface.removeColumn("job_runs", "trigger_source");
        await queryInterface.removeColumn("job_runs", "error_message");
        await queryInterface.removeColumn("job_runs", "scheduled_for");
    },
};
