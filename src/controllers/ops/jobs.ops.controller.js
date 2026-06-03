"use strict";

const Response = require("../../utils/response.util");
const JobsService = require("../../services/ops/jobs.ops.service");

async function lockOrders(req, res) {
    const delivery_date = req.body.delivery_date;
    const data = await JobsService.lockOrdersForDate({
        delivery_date,
        trigger_source: "manual",
        scheduled_for: null,
    });
    return Response.ok(res, 200, data);
}

module.exports = { lockOrders };