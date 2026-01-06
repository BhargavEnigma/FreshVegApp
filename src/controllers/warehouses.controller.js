const ResponseUtil = require("../utils/response.util");
const WarehouseService = require("../services/warehouses.service");
const {
    createWarehouseSchema,
    updateWarehouseSchema,
} = require("../validations/warehouse.validators");
    
async function create(req, res) {
    const body = createWarehouseSchema.parse(req.body);

    const warehouse = await WarehouseService.createWarehouse(body);
    return ResponseUtil.created(res, warehouse);
}

async function list(req, res) {
    const includeInactive = req.query.include_inactive === "true";

    const warehouses = await WarehouseService.listWarehouses({
        includeInactive,
    });

    return ResponseUtil.ok(res, warehouses);
}

async function getById(req, res) {
    const warehouse = await WarehouseService.getWarehouseById(req.params.id);
    if (!warehouse) {
        return ResponseUtil.notFound(res, "Warehouse not found");
    }

    return ResponseUtil.ok(res, warehouse);
}

async function update(req, res) {
    const body = updateWarehouseSchema.parse(req.body);

    const warehouse = await WarehouseService.updateWarehouse(
        req.params.id,
        body
    );

    if (!warehouse) {
        return ResponseUtil.notFound(res, "Warehouse not found");
    }

    return ResponseUtil.ok(res, warehouse);
}

async function deactivate(req, res) {
    const warehouse = await WarehouseService.deactivateWarehouse(
        req.params.id
    );

    if (!warehouse) {
        return ResponseUtil.notFound(res, "Warehouse not found");
    }

    return ResponseUtil.ok(res, warehouse);
}

module.exports = {
    create,
    list,
    getById,
    update,
    deactivate,
};
