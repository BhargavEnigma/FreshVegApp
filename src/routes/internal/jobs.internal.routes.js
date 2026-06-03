"use strict";

const express = require("express");
const { asyncHandler } = require("../../utils/asyncHandler");
const { env } = require("../../config/env");
const { AppError } = require("../../utils/errors");
const JobsService = require("../../services/ops/jobs.ops.service");
const { processQueuedPushNotifications } = require("../../jobs/notifications.worker");

const router = express.Router();

function todayYyyyMmDdInIST(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;

    return `${y}-${m}-${d}`;
}

function requireInternalSecret(req, _res, next) {
    const configured = env.internalJobSecret;
    const provided = String(req.headers["x-internal-job-secret"] || "").trim();

    if (!configured) {
        throw new AppError("INTERNAL_JOB_SECRET_MISSING", "Internal job secret is not configured", 500);
    }

    if (!provided || provided !== configured) {
        throw new AppError("UNAUTHORIZED_INTERNAL_JOB", "Invalid internal job secret", 401);
    }

    next();
}

router.use(requireInternalSecret);

router.post(
    "/lock-orders",
    asyncHandler(async (req, res) => {
        const delivery_date = req.body.delivery_date || todayYyyyMmDdInIST();

        const data = await JobsService.lockOrdersForDate({
            delivery_date,
            trigger_source: "cron",
        });

        res.status(200).json({
            success: true,
            status: 200,
            data,
        });
    })
);

router.post(
    "/notifications/process",
    asyncHandler(async (req, res) => {
        const batchSize = Number.parseInt(req.body.batch_size || "50", 10) || 50;
        const data = await processQueuedPushNotifications({ batchSize });

        res.status(200).json({
            success: true,
            status: 200,
            data,
        });
    })
);

module.exports = router;