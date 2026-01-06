"use strict";

module.exports = (sequelize, DataTypes) => {
    const ProductPack = sequelize.define(
        "ProductPack",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            product_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            label: {
                type: DataTypes.STRING(40),
                allowNull: false,
            },
            base_quantity: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: false,
            },
            base_unit: {
                type: DataTypes.STRING(10),
                allowNull: false,
            },
            mrp_paise: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
                validate: { min: 0 },
            },
            selling_price_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "product_packs",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "product_packs_product_id_idx", fields: ["product_id"] },
                { name: "product_packs_product_id_is_active_idx", fields: ["product_id", "is_active"] },
                { name: "product_packs_product_label_uniq", unique: true, fields: ["product_id", "label"] },
            ],
        }
    );

    ProductPack.associate = (models) => {
        ProductPack.belongsTo(models.Product, { foreignKey: "product_id", as: "product" });
        ProductPack.hasMany(models.CartItem, { foreignKey: "product_pack_id", as: "cart_items" });
        ProductPack.hasMany(models.OrderItem, { foreignKey: "product_pack_id", as: "order_items" });
    };

    return ProductPack;
};
