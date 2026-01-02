"use strict";

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define(
        "User",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            phone: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true,
            },
            full_name: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            email: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "active",
                validate: {
                    isIn: [["active", "blocked"]],
                },
            },
            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "users",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "users_status_idx", fields: ["status"] },
                { unique: true, fields: ["phone"] },
            ],
        }
    );

    User.associate = (db) => {
        User.hasMany(db.UserAddress, { foreignKey: "user_id", as: "addresses" });
        User.hasMany(db.OtpRequest, { foreignKey: "phone", sourceKey: "phone", as: "otp_requests" }); // by phone
        User.hasMany(db.UserSession, { foreignKey: "user_id", as: "sessions" });
        User.hasMany(db.Cart, { foreignKey: "user_id", as: "carts" });
        User.hasMany(db.Order, { foreignKey: "user_id", as: "orders" });
    };

    return User;
};
