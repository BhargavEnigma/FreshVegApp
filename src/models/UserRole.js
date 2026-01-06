"use strict";

module.exports = (sequelize, DataTypes) => {
    const UserRole = sequelize.define(
        "UserRole",
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            role: {
                // "customer" | "admin" | "warehouse_manager"
                type: DataTypes.STRING(40),
                allowNull: false,
            },
        },
        {
            tableName: "user_roles",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false, // no updated_at in migration (if you add it, change this)
            indexes: [
                { name: "user_roles_user_id_idx", fields: ["user_id"] },
                { name: "user_roles_role_idx", fields: ["role"] },
                { name: "user_roles_user_id_role_uniq", unique: true, fields: ["user_id", "role"] },
            ],
        }
    );

    UserRole.associate = (models) => {
        UserRole.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return UserRole;
};
