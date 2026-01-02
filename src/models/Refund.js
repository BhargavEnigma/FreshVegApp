"use strict";

module.exports = (sequelize, DataTypes) => {
    const Refund = sequelize.define(
        "Refund",
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
            payment_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: { isIn: [["initiated", "succeeded", "failed"]] },
            },
            amount_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            provider_refund_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            provider_payload: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            tableName: "refunds",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [{ name: "refunds_order_idx", fields: ["order_id"] }],
        }
    );

    Refund.associate = (db) => {
        Refund.belongsTo(db.Order, { foreignKey: "order_id", as: "order" });
        Refund.belongsTo(db.Payment, { foreignKey: "payment_id", as: "payment" });
    };

    return Refund;
};
