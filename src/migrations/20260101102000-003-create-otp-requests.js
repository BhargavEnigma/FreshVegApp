"use strict";

/** @type {import('sequelize-cli').Migration} */
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

        await queryInterface.createTable("otp_requests", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            phone: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            provider: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "msg91",
            },
            provider_request_id: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            purpose: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "login",
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "sent",
            },
            attempt_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            ip_address: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await safeAddIndex("otp_requests", ["phone", "created_at"], {
            name: "otp_requests_phone_created_idx",
        });

        await safeAddIndex("otp_requests", ["status"], {
            name: "otp_requests_status_idx",
        });

        await safeQuery(`
            ALTER TABLE otp_requests
            ADD CONSTRAINT otp_requests_purpose_check
            CHECK (purpose IN ('login'));
        `);

        await safeQuery(`
            ALTER TABLE otp_requests
            ADD CONSTRAINT otp_requests_status_check
            CHECK (status IN ('sent', 'verified', 'failed', 'expired'));
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("otp_requests");
    },
};
