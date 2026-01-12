"use strict";

module.exports = (sequelize, DataTypes) => {
    const ProductImage = sequelize.define(
        "ProductImage",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            product_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            image_url: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            storage_provider: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            storage_path: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: "product_images",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false, // doc shows only created_at for this optional table
            indexes: [{ name: "product_images_product_idx", fields: ["product_id", "sort_order"] }],
        }
    );

    ProductImage.associate = (db) => {
        ProductImage.belongsTo(db.Product, { foreignKey: "product_id", as: "product" });
    };

    return ProductImage;
};
