"use strict";

module.exports = (sequelize, DataTypes) => {
    const Setting = sequelize.define(
        "Setting",
        {
            key: {
                type: DataTypes.STRING(80),
                primaryKey: true,
                allowNull: false,
            },
            value: {
                type: DataTypes.JSONB,
                allowNull: false,
            },
        },
        {
            tableName: "settings",
            underscored: true,
            timestamps: true,
            createdAt: false,
            updatedAt: "updated_at",
        }
    );

    return Setting;
};
