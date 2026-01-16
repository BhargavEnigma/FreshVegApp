"use strict";

const { AppError } = require("../utils/errors");

// Central place for unit normalization and price derivation.
//
// Rounding rule:
// - We always round to the nearest paisa using Math.round.
// - This keeps results deterministic and avoids systematic bias.

function normalizeUnit(rawUnit) {
    if (rawUnit === null || rawUnit === undefined) return null;

    const u = String(rawUnit).trim().toLowerCase();
    if (!u) return null;

    // Weight units
    if (u === "g" || u === "gm" || u === "gram" || u === "grams") return "g";
    if (u === "kg" || u === "kgs" || u === "kilogram" || u === "kilograms") return "kg";

    // Piece units
    if (u === "pc" || u === "pcs" || u === "piece" || u === "pieces") return "pc";

    return u; // unknown; caller will validate
}

function parsePositiveNumber(value, label) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        throw new AppError("INVALID_BASE_QUANTITY", `${label} base_quantity must be > 0`, 400);
    }
    return n;
}

function assertSupportedUnit(unit, label) {
    const u = normalizeUnit(unit);
    if (!u) {
        throw new AppError("INVALID_UNIT", `${label} unit is required`, 400);
    }
    if (!["g", "kg", "pc"].includes(u)) {
        throw new AppError("UNSUPPORTED_UNIT", `${label} unit '${unit}' is not supported`, 400);
    }
    return u;
}

function canConvert(productUnit, packUnit) {
    if (productUnit === packUnit) return true;
    const weight = new Set(["g", "kg"]);
    if (weight.has(productUnit) && weight.has(packUnit)) return true;
    return false;
}

function convertQuantityToUnit(qty, fromUnit, toUnit) {
    if (fromUnit === toUnit) return qty;

    // Weight conversions
    if (fromUnit === "kg" && toUnit === "g") return qty * 1000;
    if (fromUnit === "g" && toUnit === "kg") return qty / 1000;

    throw new AppError(
        "PACK_UNIT_CONVERSION_NOT_SUPPORTED",
        `Cannot convert quantity from '${fromUnit}' to '${toUnit}'`,
        400
    );
}

/**
 * Derive pack prices from a parent product.
 *
 * Inputs:
 *  - product: { unit, base_quantity, mrp_paise, selling_price_paise }
 *  - pack:    { base_unit, base_quantity }
 *
 * Output:
 *  - { mrp_paise, selling_price_paise } (integers, paise)
 */
function calculatePackPricesFromProduct({ product, pack }) {
    if (!product) {
        throw new AppError("PRODUCT_NOT_FOUND", "Product not found for pack pricing", 404);
    }
    if (!pack) {
        throw new AppError("PACK_INVALID", "Pack payload is required for pricing", 400);
    }

    const productUnit = assertSupportedUnit(product.unit, "Product");
    console.log('Products unit : ', productUnit);
    const packUnit = assertSupportedUnit(pack.base_unit, "Pack");
    console.log('packUnit unit : ', productUnit);


    if (!canConvert(productUnit, packUnit)) {
        throw new AppError(
            "PACK_UNIT_CONVERSION_NOT_SUPPORTED",
            `Cannot derive pack price: product unit '${productUnit}' is incompatible with pack unit '${packUnit}'`,
            400
        );
    }

    const productQty = parsePositiveNumber(product.base_quantity, "Product");
    const packQty = parsePositiveNumber(pack.base_quantity, "Pack");

    const productMrp = Number(product.mrp_paise);
    const productSelling = Number(product.selling_price_paise);

    if (!Number.isFinite(productMrp) || productMrp < 0) {
        throw new AppError("INVALID_PRICE", "Product mrp_paise is invalid", 400);
    }
    if (!Number.isFinite(productSelling) || productSelling < 0) {
        throw new AppError("INVALID_PRICE", "Product selling_price_paise is invalid", 400);
    }

    // Convert product quantity into pack unit (common unit = packUnit)
    const productQtyInPackUnit = convertQuantityToUnit(productQty, productUnit, packUnit);
    const packQtyInPackUnit = packQty; // already in packUnit

    const unitMrp = productMrp / productQtyInPackUnit;
    const unitSelling = productSelling / productQtyInPackUnit;

    const packMrp = Math.round(unitMrp * packQtyInPackUnit);
    const packSelling = Math.round(unitSelling * packQtyInPackUnit);

    if (!Number.isFinite(packMrp) || packMrp < 0 || !Number.isFinite(packSelling) || packSelling < 0) {
        throw new AppError("PRICE_CALCULATION_FAILED", "Failed to calculate pack prices", 500);
    }

    return {
        mrp_paise: packMrp,
        selling_price_paise: packSelling,
    };
}

module.exports = {
    normalizeUnit,
    calculatePackPricesFromProduct,
};
