const { sequelize, Warehouse, WarehouseServiceArea } = require("../models");

async function createWarehouse(payload) {
    return sequelize.transaction(async (transaction) => {
        const { service_areas = [], ...warehousePayload } = payload;

        const warehouse = await Warehouse.create(warehousePayload, { transaction });

        if (service_areas.length > 0) {
            await WarehouseServiceArea.bulkCreate(
                service_areas.map((area) => ({
                    ...area,
                    warehouse_id: warehouse.id,
                })),
                { transaction }
            );
        }

        return Warehouse.findByPk(warehouse.id, {
            include: [
                {
                    model: WarehouseServiceArea,
                    as: "service_areas",
                },
            ],
            transaction,
        });
    });
}

async function listWarehouses({ includeInactive = false }) {
    const where = includeInactive ? {} : { is_active: true };

    return Warehouse.findAll({
        where,
        order: [["created_at", "DESC"]],
    });
}

async function getWarehouseById(id) {
    return Warehouse.findByPk(id, {
        include: [
            {
                model: sequelize.models.WarehouseServiceArea,
                as: "service_areas",
                required: false,
            },
        ],
    });
}

async function updateWarehouse(id, payload) {
    return sequelize.transaction(async (transaction) => {
        const warehouse = await Warehouse.findByPk(id, { transaction });

        if (!warehouse) return null;

        const {
            service_areas = [],
            ...warehousePayload
        } = payload;

        // Update warehouse basic fields
        await warehouse.update(warehousePayload, { transaction });

        // Replace service areas completely
        // Simple + clean approach for admin panel management
        if (Array.isArray(service_areas)) {
            // Remove old areas
            await WarehouseServiceArea.destroy({
                where: {
                    warehouse_id: warehouse.id,
                },
                transaction,
            });

            // Insert new areas
            if (service_areas.length > 0) {
                await WarehouseServiceArea.bulkCreate(
                    service_areas.map((area) => ({
                        ...area,
                        warehouse_id: warehouse.id,
                    })),
                    { transaction }
                );
            }
        }

        // Return updated warehouse with service areas
        return Warehouse.findByPk(warehouse.id, {
            include: [
                {
                    model: WarehouseServiceArea,
                    as: "service_areas",
                },
            ],
            transaction,
        });
    });
}

async function deactivateWarehouse(id) {
    const warehouse = await Warehouse.findByPk(id);
    if (!warehouse) return null;

    await warehouse.update({ is_active: false });
    return warehouse;
}

/**
 * Phase-1 rule:
 * exactly ONE active warehouse → used by checkout
 */
async function getDefaultWarehouse() {
    return Warehouse.findOne({
        where: { is_active: true },
        order: [["created_at", "ASC"]],
    });
}

async function findServiceableWarehouseForAddress(address) {
    const serviceArea = await WarehouseServiceArea.findOne({
        where: {
            city: address.city,
            area_name: address.area_name,
            pincode: address.pincode,
            is_active: true,
        },
        include: [
            {
                model: Warehouse,
                as: "warehouse",
                where: {
                    is_active: true,
                },
            },
        ],
    });

    if (!serviceArea) {
        return null;
    }

    return serviceArea.warehouse;
}

module.exports = {
    createWarehouse,
    listWarehouses,
    getWarehouseById,
    updateWarehouse,
    deactivateWarehouse,
    getDefaultWarehouse,
    findServiceableWarehouseForAddress
};
