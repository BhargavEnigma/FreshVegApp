"use strict";

module.exports = (sequelize, DataTypes) => {
    const Product = sequelize.define(
        "Product",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            category_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            unit: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            base_quantity: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: false,
            },
            mrp_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            selling_price_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            is_out_of_stock: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            tableName: "products",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "products_category_idx", fields: ["category_id"] },
                { name: "products_active_idx", fields: ["is_active", "is_out_of_stock"] },
                { name: "products_name_idx", fields: ["name"] },
            ],
        }
    );

    Product.associate = (db) => {
        Product.belongsTo(db.Category, { foreignKey: "category_id", as: "category" });
        Product.hasMany(db.ProductImage, { foreignKey: "product_id", as: "images" });
        Product.hasMany(db.CartItem, { foreignKey: "product_id", as: "cart_items" });
        Product.hasMany(db.OrderItem, { foreignKey: "product_id", as: "order_items" });
    };

    return Product;
};
