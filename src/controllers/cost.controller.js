"use strict";

const Response = require("../utils/response.util");
const CostService = require("../services/cost.service");

const {
    listCostsQuerySchema,
    createCostSchema,
    updateCostSchema,
    procurementItemsQuerySchema,
    bulkUpsertProcurementSchema,
} = require("../validations/cost.validation");

async function list(req, res) {
    const query = listCostsQuerySchema.parse(req.query || {});
    const data = await CostService.listCosts(query);
    return Response.ok(res, 200, data);
}

async function summary(req, res) {
    const query = listCostsQuerySchema.parse(req.query || {});
    const data = await CostService.summary(query);
    return Response.ok(res, 200, data);
}

async function profitOverview(req, res) {
    const query = listCostsQuerySchema.parse(req.query || {});
    const data = await CostService.profitOverview(query);
    return Response.ok(res, 200, data);
}

async function getById(req, res) {
    const cost = await CostService.getCostById(req.params.id);

    if (!cost) {
        return Response.fail(res, 404, "COST_NOT_FOUND", "Cost entry not found");
    }

    return Response.ok(res, 200, cost);
}

async function create(req, res) {
    const body = createCostSchema.parse(req.body || {});
    const data = await CostService.createCost({
        payload: body,
        actorUserId: req.user.userId,
    });

    return Response.created(res, 201, data);
}

async function update(req, res) {
    const body = updateCostSchema.parse(req.body || {});
    const data = await CostService.updateCost({
        id: req.params.id,
        payload: body,
    });

    if (!data) {
        return Response.fail(res, 404, "COST_NOT_FOUND", "Cost entry not found");
    }

    return Response.ok(res, 200, data);
}

async function archive(req, res) {
    const data = await CostService.archiveCost(req.params.id);

    if (!data) {
        return Response.fail(res, 404, "COST_NOT_FOUND", "Cost entry not found");
    }

    return Response.ok(res, 200, data);
}

async function procurementItems(req, res) {
    const query = procurementItemsQuerySchema.parse(req.query || {});
    const data = await CostService.procurementItems(query);
    return Response.ok(res, 200, data);
}

async function bulkUpsertProcurement(req, res) {
    const body = bulkUpsertProcurementSchema.parse(req.body || {});
    const data = await CostService.bulkUpsertProcurement({
        payload: body,
        actorUserId: req.user.userId,
    });

    return Response.ok(res, 200, data);
}

module.exports = {
    list,
    summary,
    profitOverview,
    getById,
    create,
    update,
    archive,
    procurementItems,
    bulkUpsertProcurement,
};