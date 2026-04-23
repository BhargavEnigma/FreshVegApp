"use strict";

const { Setting } = require("../models");

const PUBLIC_KEYS = [
    "service_city",
    "service_state",
    "cutoff_time_ist",
    "DELIVERY_FEE_FLAT_PAISE",
    "FREE_DELIVERY_MIN_SUBTOTAL_PAISE",
    "GST_RATE_BPS",
    "support_phone",
];

function extractScalar(value) {
    if (value == null) return null;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "object") {
        if (value.value !== undefined) return value.value;
        if (value.paise !== undefined) return value.paise;
        if (value.bps !== undefined) return value.bps;
    }
    return value;
}

async function publicSettings() {
    const rows = await Setting.findAll({
        where: { key: PUBLIC_KEYS },
    });

    const raw = {};
    for (const r of rows) {
        raw[r.key] = r.value;
    }

    return {
        settings: {
            service_city: raw.service_city ?? null,
            service_state: raw.service_state ?? null,
            cutoff_time_ist: raw.cutoff_time_ist ?? null,
            DELIVERY_FEE_FLAT_PAISE: extractScalar(raw.DELIVERY_FEE_FLAT_PAISE),
            FREE_DELIVERY_MIN_SUBTOTAL_PAISE: extractScalar(raw.FREE_DELIVERY_MIN_SUBTOTAL_PAISE),
            GST_RATE_BPS: extractScalar(raw.GST_RATE_BPS),
            support_phone: raw.support_phone ?? null,

            // backward-compatible aliases for clients using old names
            order_cutoff_time: raw.cutoff_time_ist ?? null,
            delivery_fee_paise: extractScalar(raw.DELIVERY_FEE_FLAT_PAISE),
            free_delivery_min_subtotal_paise: extractScalar(raw.FREE_DELIVERY_MIN_SUBTOTAL_PAISE),
            gst_rate_bps: extractScalar(raw.GST_RATE_BPS),
        },
    };
}

module.exports = {
    publicSettings,
};