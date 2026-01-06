"use strict";

module.exports = (sequelize, DataTypes) => {
    const Warehouse = sequelize.define(
        "Warehouse",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            address_line1: {
                type: DataTypes.STRING(250),
                allowNull: false,
            },
            address_line2: {
                type: DataTypes.STRING(250),
                allowNull: true,
                defaultValue: null,
            },
            city: {
                type: DataTypes.STRING(80),
                allowNull: true,
                defaultValue: null,
            },
            state: {
                type: DataTypes.STRING(80),
                allowNull: true,
                defaultValue: null,
            },
            pincode: {
                type: DataTypes.STRING(10),
                allowNull: true,
                defaultValue: null,
            },
            lat: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: true,
                defaultValue: null,
            },
            lng: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: true,
                defaultValue: null,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "warehouses",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    Warehouse.associate = (models) => {
        Warehouse.hasMany(models.Order, {
            foreignKey: "warehouse_id",
            as: "orders",
        });
    };

    return Warehouse;
};
