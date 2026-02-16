"use strict";

const cron = require("node-cron");
const { SchedulerSetting } = require("../models");
const { lockOrdersForDate } = require("../services/ops/jobs.ops.service");
const { validateCronExpr } = require("../utils/cron.util");

let lockOrdersTask = null;

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

function addDays(yyyyMmDd, days) {
    const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

async function recordSchedulerFailure({ job_name, message }) {
    try {
        const row = await SchedulerSetting.findOne({ where: { job_name } });
        if (!row) {
            return;
        }

        const nextFailures = Number(row.consecutive_failures || 0) + 1;
        const maxFailures = Number(row.max_consecutive_failures || 3);

        const shouldPause = nextFailures >= maxFailures;
        await row.update({
            consecutive_failures: nextFailures,
            last_error_message: String(message || "Unknown error"),
            last_failed_at: new Date(),
            ...(shouldPause
                ? {
                    is_enabled: false,
                    paused_at: new Date(),
                    pause_reason: `Paused after ${nextFailures} consecutive failures`,
                }
                : {}),
        });

        if (shouldPause) {
            // Stop the currently scheduled task too.
            if (lockOrdersTask) {
                lockOrdersTask.stop();
                lockOrdersTask = null;
            }
        }
    } catch (e) {
        console.error("[scheduler] failed to persist failure policy", e);
    }
}

async function recordSchedulerSuccess({ job_name }) {
    try {
        const row = await SchedulerSetting.findOne({ where: { job_name } });
        if (!row) {
            return;
        }
        if ((row.consecutive_failures || 0) !== 0 || row.last_error_message || row.last_failed_at) {
            await row.update({
                consecutive_failures: 0,
                last_error_message: null,
                last_failed_at: null,
            });
        }
    } catch (e) {
        console.error("[scheduler] failed to reset failures", e);
    }
}

async function applyLockOrdersScheduleFromDb() {
    const row = await SchedulerSetting.findOne({ where: { job_name: "lock_orders" }, raw: true });

    const cron_expr = row?.cron_expr || "0 0 * * *";
    // const cron_expr = "*/1 * * * *";
    const timezone = row?.timezone || "Asia/Kolkata";
    const is_enabled = row?.is_enabled ?? true;
    const daysAhead = Number.parseInt(String(row?.days_ahead ?? 0), 10) || 0;

    // stop existing task if any
    if (lockOrdersTask) {
        lockOrdersTask.stop();
        lockOrdersTask = null;
    }

    if (!is_enabled) {
        console.log(`[scheduler] lock_orders disabled (db)`);
        return { enabled: false };
    }

    const v = validateCronExpr(cron_expr);
    if (!v.ok) {
        console.error(`[scheduler] invalid cron_expr="${cron_expr}" -> NOT scheduling lock_orders`);
        return { enabled: false, error: v.error || "invalid_cron_expr" };
    }

    lockOrdersTask = cron.schedule(
        cron_expr,
        async () => {
            // Keep delivery_date scoped outside try/catch so catch can persist it.
            const base = todayYyyyMmDdInIST();
            const delivery_date = addDays(base, daysAhead);

            try {
                console.log(
                    `[scheduler] lock_orders tick cron=${cron_expr} tz=${timezone} delivery_date=${delivery_date}`
                );

                await lockOrdersForDate({
                    delivery_date,
                    trigger_source: "cron",
                    scheduled_for: new Date(),
                });

                await recordSchedulerSuccess({ job_name: "lock_orders" });
                console.log(`[scheduler] lock_orders done for ${delivery_date}`);
            } catch (e) {
                console.error("[scheduler] lock_orders failed", e);
                await recordSchedulerFailure({
                    job_name: "lock_orders",
                    message: String(e?.message || e),
                });
            }
        },
        { timezone }
    );

    console.log(`[scheduler] lock_orders scheduled cron=${cron_expr} tz=${timezone} daysAhead=${daysAhead}`);
    return { enabled: true, cron_expr, timezone, days_ahead: daysAhead };
}

async function startScheduler() {
    if (process.env.ENABLE_SCHEDULER !== "true") {
        console.log("[scheduler] disabled by env ENABLE_SCHEDULER");
        return;
    }

    await applyLockOrdersScheduleFromDb();
}

module.exports = { startScheduler, applyLockOrdersScheduleFromDb };