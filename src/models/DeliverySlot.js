"use strict";

module.exports = (sequelize, DataTypes) => {
    const DeliverySlot = sequelize.define(
        "DeliverySlot",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            start_time: {
                type: DataTypes.TIME,
                allowNull: false,
            },
            end_time: {
                type: DataTypes.TIME,
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "delivery_slots",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [{ name: "delivery_slots_active_idx", fields: ["is_active"] }],
        }
    );

    DeliverySlot.associate = (db) => {
        DeliverySlot.hasMany(db.Order, { foreignKey: "delivery_slot_id", as: "orders" });
    };

    return DeliverySlot;
};
