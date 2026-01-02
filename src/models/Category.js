"use strict";

module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define(
        "Category",
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
                unique: true,
            },
            slug: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: "categories",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [{ name: "categories_active_idx", fields: ["is_active"] }],
        }
    );

    Category.associate = (db) => {
        Category.hasMany(db.Product, { foreignKey: "category_id", as: "products" });
    };

    return Category;
};
