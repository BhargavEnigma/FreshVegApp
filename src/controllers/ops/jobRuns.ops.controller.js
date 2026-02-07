"use strict";

const Response = require("../../utils/response.util");
const JobRunsService = require("../../services/ops/jobRuns.ops.service");

async function listJobRuns(req, res) {
    const data = await JobRunsService.listJobRuns({
        job_name: req.query.job_name || null,
        status: req.query.status || null,
        from: req.query.from || null,
        to: req.query.to || null,
        limit: req.query.limit || 50,
        offset: req.query.offset || 0,
    });
    return Response.ok(res, 200, data);
}

module.exports = { listJobRuns };
