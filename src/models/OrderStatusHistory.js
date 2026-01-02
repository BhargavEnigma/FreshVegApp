"use strict";

module.exports = (sequelize, DataTypes) => {
    const OrderStatusHistory = sequelize.define(
        "OrderStatusHistory",
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
            from_status: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            to_status: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            changed_by: {
                type: DataTypes.TEXT,
                allowNull: false,
                // doc: system/admin/user
            },
            note: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: "order_status_history",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false, // doc shows created_at only
            indexes: [
                {
                    name: "order_status_history_order_created_idx",
                    fields: ["order_id", "created_at"],
                },
            ],
        }
    );

    OrderStatusHistory.associate = (db) => {
        OrderStatusHistory.belongsTo(db.Order, { foreignKey: "order_id", as: "order" });
    };

    return OrderStatusHistory;
};
