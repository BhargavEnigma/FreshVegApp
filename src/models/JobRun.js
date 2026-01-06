"use strict";

module.exports = (sequelize, DataTypes) => {
    const JobRun = sequelize.define(
        "JobRun",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            job_name: {
                type: DataTypes.STRING(80),
                allowNull: false,
            },
            run_key: {
                // "YYYY-MM-DD" for daily jobs
                type: DataTypes.STRING(40),
                allowNull: false,
            },
            status: {
                // "started" | "finished" | "failed"
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "started",
            },
            finished_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
            meta: {
                type: DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: "job_runs",
            underscored: true,
            timestamps: true,
            createdAt: "started_at",
            updatedAt: false,
            indexes: [
                { name: "job_runs_job_name_run_key_uniq", unique: true, fields: ["job_name", "run_key"] },
            ],
        }
    );

    return JobRun;
};
