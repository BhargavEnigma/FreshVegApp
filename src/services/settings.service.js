"use strict";

const { Setting } = require("../models");

// Blueprint v1.2: expose only safe keys publicly
const PUBLIC_KEYS = [
    "service_city",
    "service_state",
    "delivery_fee_paise",
    "min_order_paise",
    "order_cutoff_time",
    "support_phone",
];

async function publicSettings() {
    const rows = await Setting.findAll({
        where: { key: PUBLIC_KEYS },
    });

    const map = {};
    for (const r of rows) {
        map[r.key] = r.value;
    }

    return { settings: map };
}

module.exports = {
    publicSettings,
};
