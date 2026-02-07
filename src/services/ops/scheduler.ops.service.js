"use strict";

const cron = require("node-cron");
const { SchedulerSetting } = require("../../models");
const { AppError } = require("../../utils/errors");
const { applyLockOrdersScheduleFromDb } = require("../../jobs/scheduler");
const { computeNextRunAt, getCronPresets, validateCronExpr } = require("../../utils/cron.util");

async function getLockOrdersSchedule() {
    const row = await SchedulerSetting.findOne({ where: { job_name: "lock_orders" } });

    const cron_expr = row?.cron_expr || "0 0 * * *";
    const timezone = row?.timezone || "Asia/Kolkata";
    const is_enabled = row?.is_enabled ?? true;
    const days_ahead = row?.days_ahead ?? 0;

    const validation = validateCronExpr(cron_expr);
    const { next_run_at } = is_enabled ? computeNextRunAt({ cron_expr, timezone }) : { next_run_at: null };

    return {
        job_name: "lock_orders",
        cron_expr,
        timezone,
        is_enabled,
        days_ahead,

        // Feature D(1): cron preview
        next_run_at: is_enabled ? next_run_at : null,

        // Feature D(4): pause info
        consecutive_failures: row?.consecutive_failures ?? 0,
        max_consecutive_failures: row?.max_consecutive_failures ?? 3,
        paused_at: row?.paused_at || null,
        pause_reason: row?.pause_reason || null,
        last_error_message: row?.last_error_message || null,
        last_failed_at: row?.last_failed_at || null,

        // For Admin UI
        validation: {
            ok: !!validation.ok,
            error: validation.ok ? null : validation.error,
        },
    };
}

async function getLockOrdersSchedulePresets() {
    // Feature D(2): helper dropdown values
    return {
        job_name: "lock_orders",
        timezone: "Asia/Kolkata",
        presets: getCronPresets({ timezone: "Asia/Kolkata" }),
    };
}

async function updateLockOrdersSchedule({ cron_expr, timezone, is_enabled, days_ahead }) {
    if (!cron_expr) {
        throw new AppError("VALIDATION_ERROR", "cron_expr is required", 400);
    }
    // validate strict 5-field cron
    const v = validateCronExpr(cron_expr);
    if (!v.ok || !cron.validate(cron_expr)) {
        throw new AppError("VALIDATION_ERROR", v.error || "Invalid cron_expr", 400);
    }

    const tz = timezone || "Asia/Kolkata";
    const enabled = typeof is_enabled === "boolean" ? is_enabled : true;
    const daysAhead = Number.parseInt(String(days_ahead ?? 0), 10) || 0;

    const existing = await SchedulerSetting.findOne({ where: { job_name: "lock_orders" } });
    if (!existing) {
        await SchedulerSetting.create({
            job_name: "lock_orders",
            cron_expr,
            timezone: tz,
            is_enabled: enabled,
            days_ahead: daysAhead,
        });
    } else {
        await existing.update({
            cron_expr,
            timezone: tz,
            is_enabled: enabled,
            days_ahead: daysAhead,
            ...(enabled
                ? {
                    // If admin enables scheduler again, clear pause state and failure streak.
                    paused_at: null,
                    pause_reason: null,
                    consecutive_failures: 0,
                    last_error_message: null,
                    last_failed_at: null,
                }
                : {}),
        });
    }

    // apply immediately without restarting server
    const applied = await applyLockOrdersScheduleFromDb();
    return { saved: true, applied };
}

module.exports = { getLockOrdersSchedule, getLockOrdersSchedulePresets, updateLockOrdersSchedule };