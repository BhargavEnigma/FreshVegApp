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

        await queryInterface.createTable("settings", {
            key: {
                type: Sequelize.STRING(80),
                primaryKey: true,
                allowNull: false,
            },
            value: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        // Default settings for Phase 1
        await safeQuery(`
            INSERT INTO settings (key, value)
            VALUES
                ('cutoff_time_ist', '{"hh":23,"mm":59}'),
                ('service_city', '{"name":"Ahmedabad"}')
            ON CONFLICT (key) DO NOTHING
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("settings");
    },
};
