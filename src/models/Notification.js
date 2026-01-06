"use strict";

module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define(
        "Notification",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
            },
            channel: {
                // "email" | "push"
                type: DataTypes.STRING(20),
                allowNull: false,
            },
            template: {
                type: DataTypes.STRING(60),
                allowNull: false,
            },
            payload: {
                type: DataTypes.JSONB,
                allowNull: false,
            },
            status: {
                // "queued" | "sent" | "failed"
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "queued",
            },
            attempt_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            last_error: {
                type: DataTypes.STRING(500),
                allowNull: true,
                defaultValue: null,
            },
            scheduled_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
            sent_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: "notifications",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { name: "notifications_status_scheduled_at_idx", fields: ["status", "scheduled_at"] },
                { name: "notifications_user_id_idx", fields: ["user_id"] },
            ],
        }
    );

    Notification.associate = (models) => {
        Notification.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return Notification;
};
