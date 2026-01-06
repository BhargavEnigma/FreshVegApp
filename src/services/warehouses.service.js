const { Warehouse } = require("../models");

async function createWarehouse(payload) {
    return Warehouse.create(payload);
}

async function listWarehouses({ includeInactive = false }) {
    const where = includeInactive ? {} : { is_active: true };

    return Warehouse.findAll({
        where,
        order: [["created_at", "DESC"]],
    });
}

async function getWarehouseById(id) {
    return Warehouse.findByPk(id);
}

async function updateWarehouse(id, payload) {
    const warehouse = await Warehouse.findByPk(id);
    if (!warehouse) return null;

    await warehouse.update(payload);
    return warehouse;
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

module.exports = {
    createWarehouse,
    listWarehouses,
    getWarehouseById,
    updateWarehouse,
    deactivateWarehouse,
    getDefaultWarehouse,
};
