"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("scheduler_settings", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            job_name: {
                type: Sequelize.STRING(80),
                allowNull: false,
                unique: true,
            },
            cron_expr: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            timezone: {
                type: Sequelize.STRING(60),
                allowNull: false,
                defaultValue: "Asia/Kolkata",
            },
            is_enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            days_ahead: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await queryInterface.addIndex("scheduler_settings", ["job_name"], {
            name: "scheduler_settings_job_name_uniq",
            unique: true,
        });

        // Seed default row for lock_orders
        await queryInterface.sequelize.query(`
            insert into scheduler_settings (job_name, cron_expr, timezone, is_enabled, days_ahead)
            values ('lock_orders', '0 0 * * *', 'Asia/Kolkata', true, 0)
            on conflict (job_name) do nothing;
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("scheduler_settings");
    },
};
