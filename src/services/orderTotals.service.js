"use strict";

const { Setting } = require("../models");
const { AppError } = require("../utils/errors");

// Settings keys (stored in settings.value as JSONB)
// NOTE: Kept in ALL_CAPS because you requested these keys specifically.
const SETTINGS_KEYS = {
    DELIVERY_FEE_FLAT_PAISE: "DELIVERY_FEE_FLAT_PAISE",
    FREE_DELIVERY_MIN_SUBTOTAL_PAISE: "FREE_DELIVERY_MIN_SUBTOTAL_PAISE",
    GST_RATE_BPS: "GST_RATE_BPS",
};

// Defaults (only used when the setting key is missing)
const DEFAULTS = {
    DELIVERY_FEE_FLAT_PAISE: 2000, // ₹20
    FREE_DELIVERY_MIN_SUBTOTAL_PAISE: 30000, // ₹300
    GST_RATE_BPS: 0, // 0% by default (set to 500 for 5%)
};

function toSafeInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    // money/rates are stored as integers
    return Math.trunc(n);
}

function parseIntSettingValue(raw) {
    // We store settings.value as JSONB, so it might be:
    // - number: 2000
    // - string: "2000"
    // - object: { value: 2000 } OR { paise: 2000 }
    if (raw === null || raw === undefined) return null;

    if (typeof raw === "number") return toSafeInt(raw);
    if (typeof raw === "string") return toSafeInt(raw);

    if (typeof raw === "object") {
        if (raw.value !== undefined) return toSafeInt(raw.value);
        if (raw.paise !== undefined) return toSafeInt(raw.paise);
        if (raw.bps !== undefined) return toSafeInt(raw.bps);
    }

    return null;
}

async function getIntSetting({ key, defaultValue, t }) {
    const row = await Setting.findByPk(key, { transaction: t });
    const parsed = parseIntSettingValue(row?.value);
    if (parsed === null || parsed === undefined) return defaultValue;
    return parsed;
}

function assertNonNegativeInt(n, label) {
    const x = toSafeInt(n);
    if (!Number.isFinite(x) || x < 0) {
        throw new AppError("INVALID_TOTAL", `${label} must be a non-negative integer`, 500);
    }
    return x;
}

function roundDivide(numerator, denominator) {
    // Math.round(numerator / denominator) but safe for integers
    return Math.round(Number(numerator) / Number(denominator));
}

/**
 * Compute totals for an order.
 *
 * Inputs:
 *  - subtotal_paise (int)
 *
 * Output:
 *  - { subtotal_paise, delivery_fee_paise, gst_rate_bps, gst_amount_paise, grand_total_paise }
 */
async function computeOrderTotals({ subtotal_paise, t }) {
    const subtotal = assertNonNegativeInt(subtotal_paise, "subtotal_paise");

    const deliveryFeeFlat = await getIntSetting({
        key: SETTINGS_KEYS.DELIVERY_FEE_FLAT_PAISE,
        defaultValue: DEFAULTS.DELIVERY_FEE_FLAT_PAISE,
        t,
    });

    const freeDeliveryMin = await getIntSetting({
        key: SETTINGS_KEYS.FREE_DELIVERY_MIN_SUBTOTAL_PAISE,
        defaultValue: DEFAULTS.FREE_DELIVERY_MIN_SUBTOTAL_PAISE,
        t,
    });

    const gstRateBps = await getIntSetting({
        key: SETTINGS_KEYS.GST_RATE_BPS,
        defaultValue: DEFAULTS.GST_RATE_BPS,
        t,
    });

    const safeDeliveryFeeFlat = assertNonNegativeInt(deliveryFeeFlat, "DELIVERY_FEE_FLAT_PAISE");
    const safeFreeDeliveryMin = assertNonNegativeInt(
        freeDeliveryMin,
        "FREE_DELIVERY_MIN_SUBTOTAL_PAISE"
    );
    const safeGstRateBps = assertNonNegativeInt(gstRateBps, "GST_RATE_BPS");

    const delivery_fee_paise = subtotal >= safeFreeDeliveryMin ? 0 : safeDeliveryFeeFlat;
    const taxable_amount_paise = subtotal + delivery_fee_paise;

    // gst_amount_paise = round((taxable_amount_paise * gst_rate_bps) / 10000)
    const gst_amount_paise = roundDivide(taxable_amount_paise * safeGstRateBps, 10000);
    const grand_total_paise = subtotal + delivery_fee_paise + gst_amount_paise;

    return {
        subtotal_paise: subtotal,
        delivery_fee_paise,
        gst_rate_bps: safeGstRateBps,
        gst_amount_paise,
        grand_total_paise,
    };
}

module.exports = {
    SETTINGS_KEYS,
    computeOrderTotals,
};
