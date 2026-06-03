"use strict";

const Response = require("../../utils/response.util");
const SchedulerOpsService = require("../../services/ops/scheduler.ops.service");

async function getLockOrdersSchedule(req, res) {
    const data = await SchedulerOpsService.getLockOrdersSchedule();
    return Response.ok(res, 200, data);
}

async function getLockOrdersSchedulePresets(req, res) {
    const data = await SchedulerOpsService.getLockOrdersSchedulePresets();
    return Response.ok(res, 200, data);
}

async function updateLockOrdersSchedule(req, res) {
    const data = await SchedulerOpsService.updateLockOrdersSchedule(req.body || {});
    return Response.ok(res, 200, data);
}

module.exports = { getLockOrdersSchedule, getLockOrdersSchedulePresets, updateLockOrdersSchedule };