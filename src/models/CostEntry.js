"use strict";

module.exports = (sequelize, DataTypes) => {
    const CostEntry = sequelize.define(
        "CostEntry",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            cost_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            category: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    isIn: [["procurement", "delivery", "packaging", "misc"]],
                },
            },
            warehouse_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            related_order_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            reference_type: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            reference_no: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            amount_paise: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 0 },
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "active",
                validate: {
                    isIn: [["active", "archived"]],
                },
            },
            created_by: {
                type: DataTypes.UUID,
                allowNull: true,
            },
        },
        {
            tableName: "cost_entries",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    CostEntry.associate = (db) => {
        CostEntry.belongsTo(db.Warehouse, {
            foreignKey: "warehouse_id",
            as: "warehouse",
        });

        CostEntry.belongsTo(db.User, {
            foreignKey: "created_by",
            as: "creator",
        });

        CostEntry.belongsTo(db.Order, {
            foreignKey: "related_order_id",
            as: "order",
        });
    };

    return CostEntry;
};