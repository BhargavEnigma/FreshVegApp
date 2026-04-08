"use strict";

module.exports = (sequelize, DataTypes) => {
    const UserWarehouseAssignment = sequelize.define(
        "UserWarehouseAssignment",
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
            warehouse_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
        },
        {
            tableName: "user_warehouse_assignments",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                {
                    name: "user_warehouse_assignments_user_warehouse_uniq",
                    unique: true,
                    fields: ["user_id", "warehouse_id"],
                },
            ],
        }
    );

    UserWarehouseAssignment.associate = (db) => {
        UserWarehouseAssignment.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
        UserWarehouseAssignment.belongsTo(db.Warehouse, { foreignKey: "warehouse_id", as: "warehouse" });
    };

    return UserWarehouseAssignment;
};