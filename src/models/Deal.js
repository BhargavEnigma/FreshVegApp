"use strict";

module.exports = (sequelize, DataTypes) => {
    const Deal = sequelize.define(
        "Deal",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            name: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Deals of the Day" },
            description: { type: DataTypes.TEXT, allowNull: true },

            deal_date: { type: DataTypes.DATEONLY, allowNull: false },
            starts_at: { type: DataTypes.DATE, allowNull: true },
            ends_at: { type: DataTypes.DATE, allowNull: true },

            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        },
        {
            tableName: "deals",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    Deal.associate = (db) => {
        Deal.hasMany(db.DealItem, { foreignKey: "deal_id", as: "items" });
    };

    return Deal;
};
