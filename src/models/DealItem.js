"use strict";

module.exports = (sequelize, DataTypes) => {
    const DealItem = sequelize.define(
        "DealItem",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },

            deal_id: { type: DataTypes.UUID, allowNull: false },
            product_pack_id: { type: DataTypes.UUID, allowNull: false },

            pricing_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: "fixed_price" },

            deal_price_paise: { type: DataTypes.INTEGER, allowNull: true },
            discount_bps: { type: DataTypes.INTEGER, allowNull: true },
            discount_paise: { type: DataTypes.INTEGER, allowNull: true },
            max_qty_per_order: { type: DataTypes.INTEGER, allowNull: true },

            sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        },
        {
            tableName: "deal_items",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    DealItem.associate = (db) => {
        DealItem.belongsTo(db.Deal, { foreignKey: "deal_id", as: "deal" });
        DealItem.belongsTo(db.ProductPack, { foreignKey: "product_pack_id", as: "pack" });
    };

    return DealItem;
};
