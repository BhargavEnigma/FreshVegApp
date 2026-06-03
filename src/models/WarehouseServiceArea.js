"use strict";

module.exports = (sequelize, DataTypes) => {
    const WarehouseServiceArea = sequelize.define(
        "WarehouseServiceArea",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            warehouse_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            area_name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            city: {
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
            radius_km: {
                type: DataTypes.DECIMAL(6, 2),
                allowNull: true,
                defaultValue: null,
            },
            boundary_geojson: {
                type: DataTypes.JSONB,
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
            tableName: "warehouse_service_areas",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    WarehouseServiceArea.associate = (models) => {
        WarehouseServiceArea.belongsTo(models.Warehouse, {
            foreignKey: "warehouse_id",
            as: "warehouse",
        });
    };

    return WarehouseServiceArea;
};