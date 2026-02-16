"use strict";

module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define(
        "Payment",
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
            method: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: { isIn: [["cod", "online"]] },
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: { isIn: [["pending", "paid", "failed", "refunded"]] },
            },
            amount_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            provider: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_payment_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_order_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            // Razorpay webhook event id (optional, for idempotency)
            provider_event_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_payload: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            tableName: "payments",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "payments_order_idx", fields: ["order_id"] },
                { name: "payments_status_idx", fields: ["status"] },
                {
                    name: "payments_provider_payment_id_uniq",
                    fields: ["provider", "provider_payment_id"],
                    unique: true,
                    where: { provider_payment_id: { [sequelize.Sequelize.Op.ne]: null } },
                },
                {
                    name: "payments_provider_order_id_uniq",
                    fields: ["provider", "provider_order_id"],
                    unique: true,
                    where: { provider_order_id: { [sequelize.Sequelize.Op.ne]: null } },
                },
                {
                    name: "payments_provider_event_id_uniq",
                    fields: ["provider", "provider_event_id"],
                    unique: true,
                    where: { provider_event_id: { [sequelize.Sequelize.Op.ne]: null } },
                },
            ],
        }
    );

    Payment.associate = (db) => {
        Payment.belongsTo(db.Order, { foreignKey: "order_id", as: "order" });
        Payment.hasMany(db.Refund, { foreignKey: "payment_id", as: "refunds" });
    };

    return Payment;
};
