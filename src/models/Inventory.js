"use strict";

module.exports = (sequelize, DataTypes) => {
    const Inventory = sequelize.define(
        "Inventory",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            warehouse_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            product_pack_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            available_qty: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            reserved_qty: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
        },
        {
            tableName: "inventories",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                {
                    name: "inventories_wh_pack_uniq",
                    unique: true,
                    fields: ["warehouse_id", "product_pack_id"],
                },
            ],
        }
    );

    Inventory.associate = (db) => {
        Inventory.belongsTo(db.Warehouse, { foreignKey: "warehouse_id", as: "warehouse" });
        Inventory.belongsTo(db.ProductPack, { foreignKey: "product_pack_id", as: "pack" });
    };

    return Inventory;
};