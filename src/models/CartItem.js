"use strict";

module.exports = (sequelize, DataTypes) => {
    const CartItem = sequelize.define(
        "CartItem",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            cart_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            product_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            // add inside CartItem fields
            product_pack_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            quantity: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: false,
                validate: { min: 0.001 },
            },
            price_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
        },
        {
            tableName: "cart_items",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "cart_items_cart_idx", fields: ["cart_id"] },
                { name: "cart_items_pack_id_idx", fields: ["product_pack_id"] },
                { name: "cart_items_unique_cart_pack", unique: true, fields: ["cart_id", "product_pack_id"] },
            ],

        }
    );

    CartItem.associate = (db) => {
        CartItem.belongsTo(db.Cart, { foreignKey: "cart_id", as: "cart" });
        CartItem.belongsTo(db.Product, { foreignKey: "product_id", as: "product" });
        CartItem.belongsTo(db.ProductPack, { foreignKey: "product_pack_id", as: "pack" });
    };

    return CartItem;
};
