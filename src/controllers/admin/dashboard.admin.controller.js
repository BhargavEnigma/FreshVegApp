"use strict";

const ResponseUtil = require("../../utils/response.util");
const AdminDashboardService = require("../../services/admin/dashboard.admin.service");
const { dashboardKpisQuerySchema } = require("../../validations/admin/dashboard.admin.validation");

async function getKpis(req, res) {
    const query = dashboardKpisQuerySchema.parse(req.query || {});

    const data = await AdminDashboardService.getKpis({
        range: query,
    });

    return ResponseUtil.ok(res, 200, data);
}

module.exports = {
    getKpis,
};
