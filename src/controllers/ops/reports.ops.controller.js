"use strict";

const Response = require("../../utils/response.util");
const ReportsService = require("../../services/ops/reports.ops.service");

async function procurement(req, res) {
    const delivery_date = req.query.delivery_date || req.query.date;

    const data = await ReportsService.procurementSummary({
        actorUserId: req.user.userId,
        delivery_date,
        warehouse_id: req.query.warehouse_id || null,
    });

    return Response.ok(res, 200, data);
}

module.exports = { procurement };