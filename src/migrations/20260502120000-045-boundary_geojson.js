"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("warehouse_service_areas", "boundary_geojson", {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn("warehouse_service_areas", "boundary_geojson");
    },
};