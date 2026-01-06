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

function startScheduler() {
    if (process.env.ENABLE_SCHEDULER !== "true") {
        return;
    }

    // 12:00 AM IST daily
    cron.schedule("0 0 * * *", async () => {
        try {
            const delivery_date = todayYyyyMmDdInIST();
            await lockOrdersForDate({ delivery_date });
            console.log(`[scheduler] lock_orders done for ${delivery_date}`);
        } catch (e) {
            console.error("[scheduler] lock_orders failed", e);
        }
    }, { timezone: "Asia/Kolkata" });
}

module.exports = { startScheduler };
