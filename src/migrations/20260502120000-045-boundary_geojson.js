"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if the table exists before trying to add the column
        const tables = await queryInterface.sequelize.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'warehouse_service_areas'
            );`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        const tableExists = tables[0].exists;
        
        if (tableExists) {
            // Check if column already exists
            const columns = await queryInterface.sequelize.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'warehouse_service_areas' 
                    AND column_name = 'boundary_geojson'
                );`,
                { type: queryInterface.sequelize.QueryTypes.SELECT }
            );
            
            const columnExists = columns[0].exists;
            
            if (!columnExists) {
                await queryInterface.addColumn("warehouse_service_areas", "boundary_geojson", {
                    type: Sequelize.JSONB,
                    allowNull: true,
                    defaultValue: null,
                });
            }
        } else {
            console.log("Table 'warehouse_service_areas' does not exist, skipping migration");
        }
    },

    async down(queryInterface) {
        // Check if table and column exist before trying to remove
        const tables = await queryInterface.sequelize.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'warehouse_service_areas'
            );`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        const tableExists = tables[0].exists;
        
        if (tableExists) {
            const columns = await queryInterface.sequelize.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'warehouse_service_areas' 
                    AND column_name = 'boundary_geojson'
                );`,
                { type: queryInterface.sequelize.QueryTypes.SELECT }
            );
            
            const columnExists = columns[0].exists;
            
            if (columnExists) {
                await queryInterface.removeColumn("warehouse_service_areas", "boundary_geojson");
            }
        }
    },
};