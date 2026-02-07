"use strict";

const { Sequelize, JobRun } = require("../../models");
const { AppError } = require("../../utils/errors");

const { Op } = Sequelize;

function parseIntSafe(v, defVal) {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : defVal;
}

function parseDateSafe(v) {
    if (!v) return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

async function listJobRuns({
    job_name = null,
    status = null,
    from = null,
    to = null,
    limit = 50,
    offset = 0,
} = {}) {
    const where = {};

    if (job_name) {
        where.job_name = String(job_name);
    }
    if (status) {
        where.status = String(status);
    }

    const fromDate = parseDateSafe(from);
    const toDate = parseDateSafe(to);
    if (fromDate && toDate && fromDate > toDate) {
        throw new AppError("VALIDATION_ERROR", "from must be <= to", 400);
    }

    if (fromDate || toDate) {
        where.started_at = {};
        if (fromDate) {
            where.started_at[Op.gte] = fromDate;
        }
        if (toDate) {
            where.started_at[Op.lte] = toDate;
        }
    }

    const pageLimit = Math.min(Math.max(parseIntSafe(limit, 50), 1), 200);
    const pageOffset = Math.max(parseIntSafe(offset, 0), 0);

    const { rows, count } = await JobRun.findAndCountAll({
        where,
        order: [["started_at", "DESC"]],
        limit: pageLimit,
        offset: pageOffset,
    });

    return {
        items: rows.map((r) => r.toJSON()),
        page: {
            limit: pageLimit,
            offset: pageOffset,
            total: count,
        },
    };
}

module.exports = { listJobRuns };
