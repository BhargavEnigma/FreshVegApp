"use strict";

const cron = require("node-cron");
const { lockOrdersForDate } = require("../services/ops/jobs.ops.service");

function todayYyyyMmDdInIST() {
    const now = new Date();
    // Convert to IST by using locale string and re-parsing safely
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);

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

function startScheduler() {
    if (process.env.ENABLE_SCHEDULER !== "true") {
        return;
    }

    // default 0 to preserve current behavior
    const daysAhead = Number.parseInt(process.env.ORDER_LOCK_DAYS_AHEAD || "0", 10) || 0;

    cron.schedule(
        "0 0 * * *",
        async () => {
            try {
                const base = todayYyyyMmDdInIST();
                const delivery_date = addDays(base, daysAhead);
                await lockOrdersForDate({ delivery_date });
                console.log(`[scheduler] lock_orders done for ${delivery_date}`);
            } catch (e) {
                console.error("[scheduler] lock_orders failed", e);
            }
        },
        { timezone: "Asia/Kolkata" }
    );
}

module.exports = { startScheduler };