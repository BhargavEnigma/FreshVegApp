"use strict";

const Response = require("../../utils/response.util");
const ReportsService = require("../../services/ops/reports.ops.service");

async function procurement(req, res) {
    const delivery_date = req.query.date;
    const data = await ReportsService.procurementSummary({ delivery_date });
    return Response.ok(res, data);
}

module.exports = { procurement };
