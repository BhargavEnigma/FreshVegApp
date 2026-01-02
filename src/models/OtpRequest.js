"use strict";

module.exports = (sequelize, DataTypes) => {
    const OtpRequest = sequelize.define(
        "OtpRequest",
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
            },
            provider: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "msg91",
            },
            provider_request_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            purpose: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "login",
                validate: {
                    isIn: [["login"]],
                },
            },
            status: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "sent",
                validate: {
                    isIn: [["sent", "verified", "failed", "expired"]],
                },
            },
            attempt_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            ip_address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: "otp_requests",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "otp_requests_phone_created_idx", fields: ["phone", "created_at"] },
                { name: "otp_requests_status_idx", fields: ["status"] },
            ],
        }
    );

    OtpRequest.associate = (db) => {
        // Optional association by phone (not FK in DB, but useful)
        OtpRequest.belongsTo(db.User, { foreignKey: "phone", targetKey: "phone", as: "user" });
    };

    return OtpRequest;
};
