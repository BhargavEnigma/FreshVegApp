"use strict";

module.exports = (sequelize, DataTypes) => {
    const UserAddress = sequelize.define(
        "UserAddress",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            label: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            phone: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            address_line1: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            address_line2: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            landmark: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            area: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            city: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "Ahmedabad",
            },
            state: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "Gujarat",
            },
            pincode: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            lat: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: true,
            },
            lng: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: true,
            },
            is_default: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            tableName: "user_addresses",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "user_addresses_user_id_idx", fields: ["user_id"] },
                { name: "user_addresses_default_idx", fields: ["user_id", "is_default"] },
            ],
        }
    );

    UserAddress.associate = (db) => {
        UserAddress.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
        UserAddress.hasMany(db.Order, { foreignKey: "address_id", as: "orders" });
    };

    return UserAddress;
};
