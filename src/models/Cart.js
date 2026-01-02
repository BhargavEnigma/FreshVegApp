"use strict";

module.exports = (sequelize, DataTypes) => {
    const Cart = sequelize.define(
        "Cart",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "active",
                validate: { isIn: [["active", "checked_out"]] },
            },
        },
        {
            tableName: "carts",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [{ name: "carts_user_status_idx", fields: ["user_id", "status"] }],
        }
    );

    Cart.associate = (db) => {
        Cart.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
        Cart.hasMany(db.CartItem, { foreignKey: "cart_id", as: "items" });
    };

    return Cart;
};
