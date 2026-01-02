"use strict";

module.exports = (sequelize, DataTypes) => {
    const Order = sequelize.define(
        "Order",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            order_number: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            address_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            delivery_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            delivery_slot_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "placed",
                validate: {
                    isIn: [[
                        "placed",
                        "confirmed",
                        "packed",
                        "out_for_delivery",
                        "delivered",
                        "cancelled",
                        "refunded",
                    ]],
                },
            },
            subtotal_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            delivery_fee_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            discount_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            total_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            payment_status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "pending",
                validate: { isIn: [["pending", "paid", "failed", "refunded"]] },
            },
            payment_method: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "cod",
                validate: { isIn: [["cod", "upi"]] },
            },
            is_locked: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            locked_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            cancelled_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            cancellation_reason: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: "orders",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "orders_user_created_idx", fields: ["user_id", "created_at"] },
                { name: "orders_status_idx", fields: ["status"] },
                { name: "orders_delivery_date_idx", fields: ["delivery_date"] },
                { name: "orders_locked_idx", fields: ["is_locked"] },
            ],
        }
    );

    Order.associate = (db) => {
        Order.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
        Order.belongsTo(db.UserAddress, { foreignKey: "address_id", as: "address" });
        Order.belongsTo(db.DeliverySlot, { foreignKey: "delivery_slot_id", as: "delivery_slot" });

        Order.hasMany(db.OrderItem, { foreignKey: "order_id", as: "items" });
        Order.hasMany(db.OrderStatusHistory, { foreignKey: "order_id", as: "status_history" });
        Order.hasMany(db.Payment, { foreignKey: "order_id", as: "payments" });
        Order.hasMany(db.Refund, { foreignKey: "order_id", as: "refunds" });
    };

    return Order;
};
