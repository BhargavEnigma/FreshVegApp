"use strict";

module.exports = (sequelize, DataTypes) => {
    const UserDevice = sequelize.define(
        "UserDevice",
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
            device_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            platform: {
                type: DataTypes.STRING(20),
                allowNull: true,
            },
            fcm_token: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            last_seen_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            disabled_reason: {
                type: DataTypes.STRING(120),
                allowNull: true,
            },
        },
        {
            tableName: "user_devices",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "user_devices_fcm_token_uniq", fields: ["fcm_token"], unique: true },
                {
                    name: "user_devices_user_device_id_uniq",
                    fields: ["user_id", "device_id"],
                    unique: true,
                },
                { name: "user_devices_user_active_idx", fields: ["user_id", "is_active"] },
            ],
        }
    );

    UserDevice.associate = (models) => {
        UserDevice.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    };

    return UserDevice;
};