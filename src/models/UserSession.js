"use strict";

module.exports = (sequelize, DataTypes) => {
    const UserSession = sequelize.define(
        "UserSession",
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
            refresh_token_hash: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            device_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            device_name: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            ip_address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            is_revoked: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            revoked_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: "user_sessions",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "user_sessions_user_id_idx", fields: ["user_id"] },
                { name: "user_sessions_token_hash_idx", fields: ["refresh_token_hash"] },
                { name: "user_sessions_active_idx", fields: ["user_id", "is_revoked", "expires_at"] },
            ],
        }
    );

    UserSession.associate = (db) => {
        UserSession.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
    };

    return UserSession;
};
