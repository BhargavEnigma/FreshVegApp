"use strict";

module.exports = (sequelize, DataTypes) => {
    const Banner = sequelize.define(
        "Banner",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },

            title: { type: DataTypes.TEXT, allowNull: true },
            subtitle: { type: DataTypes.TEXT, allowNull: true },

            image_url: { type: DataTypes.TEXT, allowNull: false },

            storage_provider: { type: DataTypes.TEXT, allowNull: true },
            storage_path: { type: DataTypes.TEXT, allowNull: true },

            placement: { type: DataTypes.TEXT, allowNull: false, defaultValue: "home" },

            action_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: "none" },
            action_value: { type: DataTypes.TEXT, allowNull: true },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },

            start_at: { type: DataTypes.DATE, allowNull: true },
            end_at: { type: DataTypes.DATE, allowNull: true },

            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        },
        {
            tableName: "banners",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "banners_active_order_idx", fields: ["placement", "is_active", "sort_order"] },
            ],
        }
    );

    return Banner;
};
