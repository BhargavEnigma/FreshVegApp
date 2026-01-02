"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
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

        await queryInterface.addIndex("otp_requests", ["phone", "created_at"], {
            name: "otp_requests_phone_created_idx",
        });

        await queryInterface.addIndex("otp_requests", ["status"], {
            name: "otp_requests_status_idx",
        });

        await queryInterface.sequelize.query(`
            ALTER TABLE otp_requests
            ADD CONSTRAINT otp_requests_purpose_check
            CHECK (purpose IN ('login'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE otp_requests
            ADD CONSTRAINT otp_requests_status_check
            CHECK (status IN ('sent', 'verified', 'failed', 'expired'));
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("otp_requests");
    },
};
