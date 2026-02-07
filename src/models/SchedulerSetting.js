"use strict";

module.exports = (sequelize, DataTypes) => {
    const SchedulerSetting = sequelize.define(
        "SchedulerSetting",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            job_name: {
                type: DataTypes.STRING(80),
                allowNull: false,
                unique: true,
            },
            cron_expr: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            timezone: {
                type: DataTypes.STRING(60),
                allowNull: false,
                defaultValue: "Asia/Kolkata",
            },
            is_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            days_ahead: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            consecutive_failures: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            max_consecutive_failures: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 3,
            },
            paused_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
            pause_reason: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null,
            },
            last_error_message: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null,
            },
            last_failed_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: "scheduler_settings",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [{ name: "scheduler_settings_job_name_uniq", fields: ["job_name"], unique: true }],
        }
    );

    return SchedulerSetting;
};