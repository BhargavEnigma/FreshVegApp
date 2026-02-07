"use strict";

const cron = require("node-cron");
const cronParser = require("cron-parser");

// NOTE:
// - We treat cron expressions as standard 5-field cron: "m h dom mon dow".
// - Timezone must be an IANA TZ string (e.g., "Asia/Kolkata").

function validateCronExpr(cronExpr) {
    if (!cronExpr || typeof cronExpr !== "string") {
        return { ok: false, error: "cron_expr is required" };
    }

    // node-cron validates 5 fields (and optional seconds if enabled).
    // Your backend uses 5-field strings everywhere, so enforce that.
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) {
        return { ok: false, error: "cron_expr must have 5 fields (min hour dom mon dow)" };
    }

    if (!cron.validate(cronExpr)) {
        return { ok: false, error: "Invalid cron_expr" };
    }

    return { ok: true };
}

function computeNextRunAt({ cron_expr, timezone, now = new Date() }) {
    const tz = timezone || "Asia/Kolkata";

    const v = validateCronExpr(cron_expr);
    if (!v.ok) {
        return { next_run_at: null, error: v.error };
    }

    try {
        // cron-parser can compute next occurrences; it supports tz.
        // We return ISO timestamptz (UTC ISO string). Consumers can render in IST.
        const interval = cronParser.parseExpression(cron_expr, {
            currentDate: now,
            tz,
        });
        const next = interval.next().toDate();
        return { next_run_at: next.toISOString(), error: null };
    } catch (e) {
        return { next_run_at: null, error: String(e?.message || e) };
    }
}

function getCronPresets({ timezone = "Asia/Kolkata" } = {}) {
    // Keep this list stable for the Admin Panel dropdown.
    // All presets are 5-field cron.
    return [
        {
            key: "daily_midnight_ist",
            label: "Every day 12:00 AM IST",
            cron_expr: "0 0 * * *",
            timezone,
            description: "Runs once daily at 00:00 in Asia/Kolkata",
        },
        {
            key: "daily_1am_ist",
            label: "Every day 1:00 AM IST",
            cron_expr: "0 1 * * *",
            timezone,
            description: "Runs once daily at 01:00 in Asia/Kolkata",
        },
        {
            key: "hourly",
            label: "Every hour",
            cron_expr: "0 * * * *",
            timezone,
            description: "Runs at minute 0 of every hour",
        },
        {
            key: "every_15_min",
            label: "Every 15 minutes",
            cron_expr: "*/15 * * * *",
            timezone,
            description: "Runs every 15 minutes",
        },
        {
            key: "every_5_min",
            label: "Every 5 minutes",
            cron_expr: "*/5 * * * *",
            timezone,
            description: "Runs every 5 minutes (useful for testing)",
        },
    ];
}

module.exports = {
    validateCronExpr,
    computeNextRunAt,
    getCronPresets,
};