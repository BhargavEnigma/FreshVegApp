"use strict";

module.exports = (sequelize, DataTypes) => {
    const PaymentAttempt = sequelize.define(
        "PaymentAttempt",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            order_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            attempt_no: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 1 },
            },
            provider: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "razorpay",
            },
            provider_order_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_payment_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_signature: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            amount_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            currency: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "INR",
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    isIn: [[
                        "pending",
                        "provider_order_created",
                        "verification_pending",
                        "paid",
                        "failed",
                        "refund_pending",
                        "refunded",
                        "refund_failed",
                    ]],
                },
            },
            failure_code: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            failure_reason: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            verify_response_raw: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            tableName: "payment_attempts",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "payment_attempts_order_attempt_idx", fields: ["order_id", "attempt_no"], unique: true },
                { name: "payment_attempts_order_created_idx", fields: ["order_id", "created_at"] },
                { name: "payment_attempts_status_idx", fields: ["status"] },
                {
                    name: "payment_attempts_provider_order_id_uniq",
                    fields: ["provider", "provider_order_id"],
                    unique: true,
                    where: { provider_order_id: { [sequelize.Sequelize.Op.ne]: null } },
                },
                {
                    name: "payment_attempts_provider_payment_id_uniq",
                    fields: ["provider", "provider_payment_id"],
                    unique: true,
                    where: { provider_payment_id: { [sequelize.Sequelize.Op.ne]: null } },
                },
            ],
        }
    );

    PaymentAttempt.associate = (db) => {
        PaymentAttempt.belongsTo(db.Order, { foreignKey: "order_id", as: "order" });
    };

    return PaymentAttempt;
};
