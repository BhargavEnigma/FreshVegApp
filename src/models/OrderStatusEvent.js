"use strict";

module.exports = (sequelize, DataTypes) => {
    const OrderStatusEvent = sequelize.define(
        "OrderStatusEvent",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            order_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            from_status: {
                type: DataTypes.STRING(40),
                allowNull: true,
                defaultValue: null,
            },
            to_status: {
                type: DataTypes.STRING(40),
                allowNull: false,
            },
            actor_user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
            },
            note: {
                type: DataTypes.STRING(500),
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
            tableName: "order_status_events",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false,
            indexes: [
                { name: "order_status_events_order_id_created_at_idx", fields: ["order_id", "created_at"] },
            ],
        }
    );

    OrderStatusEvent.associate = (models) => {
        OrderStatusEvent.belongsTo(models.Order, {
            foreignKey: "order_id",
            as: "order",
        });

        OrderStatusEvent.belongsTo(models.User, {
            foreignKey: "actor_user_id",
            as: "actor",
        });
    };

    return OrderStatusEvent;
};
