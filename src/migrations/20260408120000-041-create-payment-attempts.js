"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("payment_attempts", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            order_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "orders", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            attempt_no: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            provider: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "razorpay",
            },
            provider_order_id: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            provider_payment_id: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            provider_signature: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            amount_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            currency: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "INR",
            },
            status: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            failure_code: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            failure_reason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            verify_response_raw: {
                type: Sequelize.JSONB,
                allowNull: true,
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

        await queryInterface.addIndex("payment_attempts", ["order_id", "attempt_no"], {
            name: "payment_attempts_order_attempt_idx",
            unique: true,
        });
        await queryInterface.addIndex("payment_attempts", ["order_id", "created_at"], {
            name: "payment_attempts_order_created_idx",
        });
        await queryInterface.addIndex("payment_attempts", ["status"], {
            name: "payment_attempts_status_idx",
        });
        await queryInterface.addIndex("payment_attempts", ["provider", "provider_order_id"], {
            name: "payment_attempts_provider_order_id_uniq",
            unique: true,
            where: {
                provider_order_id: { [Sequelize.Op.ne]: null },
            },
        });
        await queryInterface.addIndex("payment_attempts", ["provider", "provider_payment_id"], {
            name: "payment_attempts_provider_payment_id_uniq",
            unique: true,
            where: {
                provider_payment_id: { [Sequelize.Op.ne]: null },
            },
        });

        await queryInterface.sequelize.query(`
            ALTER TABLE payment_attempts
            ADD CONSTRAINT payment_attempts_status_check
            CHECK (status IN ('pending','provider_order_created','verification_pending','paid','failed','refund_pending','refunded','refund_failed'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE payment_attempts
            ADD CONSTRAINT payment_attempts_amount_paise_check
            CHECK (amount_paise >= 0);
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE payment_attempts
            ADD CONSTRAINT payment_attempts_attempt_no_check
            CHECK (attempt_no >= 1);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("payment_attempts");
    },
};
