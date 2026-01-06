"use strict";

module.exports = (sequelize, DataTypes) => {
    const OrderItem = sequelize.define(
        "OrderItem",
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
            product_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            product_pack_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            pack_label: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            product_name: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            unit: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            quantity: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: false,
                validate: { min: 0.001 },
            },
            unit_price_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            line_total_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
        },
        {
            tableName: "order_items",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false, // doc shows created_at only
            indexes: [{ name: "order_items_order_idx", fields: ["order_id"] }],
        }
    );

    OrderItem.associate = (db) => {
        OrderItem.belongsTo(db.Order, { foreignKey: "order_id", as: "order" });
        OrderItem.belongsTo(db.Product, { foreignKey: "product_id", as: "product" });
        OrderItem.belongsTo(db.ProductPack, { foreignKey: "product_pack_id", as: "pack" });
    };

    return OrderItem;
};
