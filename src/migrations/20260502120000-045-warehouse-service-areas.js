"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("warehouse_service_areas", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },

            warehouse_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "warehouses",
                    key: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },

            area_name: {
                type: Sequelize.STRING(120),
                allowNull: false,
            },

            city: {
                type: Sequelize.STRING(80),
                allowNull: true,
                defaultValue: null,
            },

            pincode: {
                type: Sequelize.STRING(10),
                allowNull: true,
                defaultValue: null,
            },

            lat: {
                type: Sequelize.DECIMAL(10, 7),
                allowNull: true,
                defaultValue: null,
            },

            lng: {
                type: Sequelize.DECIMAL(10, 7),
                allowNull: true,
                defaultValue: null,
            },

            radius_km: {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: true,
                defaultValue: null,
            },

            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },

            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },

            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        const indexes = await queryInterface.showIndex("warehouse_service_areas");

        const warehouseIdxExists = indexes.some(
            (i) => i.name === "warehouse_service_areas_warehouse_id_idx"
        );

        if (!warehouseIdxExists) {
            await queryInterface.addIndex(
                "warehouse_service_areas",
                ["warehouse_id"],
                {
                    name: "warehouse_service_areas_warehouse_id_idx",
                }
            );
        }

        const areaNameExists = indexes.some(
            (i) => i.name === "warehouse_service_areas_area_name_idx"
        );

        if (!areaNameExists) {
            await queryInterface.addIndex(
                "warehouse_service_areas",
                ["area_name"],
                {
                    name: "warehouse_service_areas_area_name_idx",
                }
            );
        }

        const pincodeExists = indexes.some(
            (i) => i.name === "warehouse_service_areas_pincode_idx"
        );

        if (!pincodeExists) {
            await queryInterface.addIndex(
                "warehouse_service_areas",
                ["pincode"],
                {
                    name: "warehouse_service_areas_pincode_idx",
                }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable("warehouse_service_areas");
    },
};