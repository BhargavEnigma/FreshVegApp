"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {

const safeAddIndex = async (table, fields, options) => {
    try {
        await queryInterface.addIndex(table, fields, options);
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

const safeQuery = async (sql) => {
    try {
        await queryInterface.sequelize.query(sql);
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

        await queryInterface.createTable("job_runs", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            job_name: {
                type: Sequelize.STRING(80),
                allowNull: false,
            },
            run_key: {
                // ex: "2026-01-02" for midnight lock job
                type: Sequelize.STRING(40),
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: "started",
            },
            started_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
            finished_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            meta: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
        });

        await queryInterface.addConstraint("job_runs", {
            fields: ["job_name", "run_key"],
            type: "unique",
            name: "job_runs_job_name_run_key_uniq",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("job_runs");
    },
};
