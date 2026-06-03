"use strict";

module.exports = (sequelize, DataTypes) => {
    const ProcurementCost = sequelize.define(
        "ProcurementCost",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            delivery_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            warehouse_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            product_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            product_pack_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            product_name: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            pack_label: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            ordered_quantity: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: false,
            },
            unit_cost_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            total_cost_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            created_by: {
                type: DataTypes.UUID,
                allowNull: true,
            },
        },
        {
            tableName: "procurement_costs",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    ProcurementCost.associate = (db) => {
        ProcurementCost.belongsTo(db.Warehouse, {
            foreignKey: "warehouse_id",
            as: "warehouse",
        });

        ProcurementCost.belongsTo(db.Product, {
            foreignKey: "product_id",
            as: "product",
        });

        ProcurementCost.belongsTo(db.ProductPack, {
            foreignKey: "product_pack_id",
            as: "pack",
        });

        ProcurementCost.belongsTo(db.User, {
            foreignKey: "created_by",
            as: "creator",
        });
    };

    return ProcurementCost;
};