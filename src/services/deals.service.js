"use strict";

const { Op } = require("sequelize");

const { Deal, DealItem, ProductPack, Product } = require("../models");
const { AppError } = require("../utils/errors");

function getIstYyyyMmDd() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;

    return `${y}-${m}-${d}`;
}

function computeDealUnitPrice({ basePricePaise, dealItem }) {
    const base = Number(basePricePaise);
    if (!Number.isFinite(base) || base < 0) return base;

    const t = String(dealItem.pricing_type || "fixed_price");

    if (t === "fixed_price") {
        const v = dealItem.deal_price_paise;
        return v === null || v === undefined ? base : Math.max(0, Number(v));
    }

    if (t === "percent_off") {
        const bps = Number(dealItem.discount_bps || 0);
        if (!Number.isFinite(bps) || bps <= 0) return base;
        const discount = Math.round((base * bps) / 10000);
        return Math.max(0, base - discount);
    }

    if (t === "amount_off") {
        const amt = Number(dealItem.discount_paise || 0);
        if (!Number.isFinite(amt) || amt <= 0) return base;
        return Math.max(0, base - amt);
    }

    return base;
}

async function getActiveDealsForDate({ date, now = new Date() }) {
    const yyyyMmDd = date || getIstYyyyMmDd();

    const deals = await Deal.findAll({
        where: {
            deal_date: yyyyMmDd,
            is_active: true,
            [Op.and]: [
                {
                    [Op.or]: [
                        { starts_at: null },
                        { starts_at: { [Op.lte]: now } },
                    ],
                },
                {
                    [Op.or]: [
                        { ends_at: null },
                        { ends_at: { [Op.gte]: now } },
                    ],
                },
            ],
        },
        order: [
            ["priority", "DESC"],
            ["created_at", "DESC"],
            [{ model: DealItem, as: "items" }, "sort_order", "ASC"],
            [{ model: DealItem, as: "items" }, "created_at", "ASC"],
        ],
        include: [
            {
                model: DealItem,
                as: "items",
                where: { is_active: true },
                required: false,
                include: [
                    {
                        model: ProductPack,
                        as: "pack",
                        required: true,
                        where: { is_active: true },
                        include: [
                            {
                                model: Product,
                                as: "product",
                                required: true,
                                where: { is_active: true },
                            },
                        ],
                    },
                ],
            },
        ],
    });

    return { deals };
}

async function getToday({ date = null }) {
    try {
        const { deals } = await getActiveDealsForDate({ date });

        if (!deals || deals.length === 0) {
            return { deals: [] };
        }

        return {
            deals: deals.map((deal) => ({
                id: deal.id,
                name: deal.name,
                description: deal.description,
                deal_date: deal.deal_date,
                starts_at: deal.starts_at,
                ends_at: deal.ends_at,
                is_active: deal.is_active,
                priority: deal.priority,

                items: (deal.items || []).map((row) => {
                    const pack = row.pack;
                    const product = pack?.product;

                    const base_price_paise = Number(pack?.selling_price_paise ?? 0);

                    const deal_price_paise = computeDealUnitPrice({
                        basePricePaise: base_price_paise,
                        dealItem: row,
                    });

                    const discount_paise = Math.max(0, base_price_paise - deal_price_paise);

                    return {
                        id: row.id,
                        deal_id: row.deal_id,
                        product_pack_id: row.product_pack_id,
                        pricing_type: row.pricing_type,
                        deal_price_paise: row.deal_price_paise,
                        discount_bps: row.discount_bps,
                        discount_paise: row.discount_paise,
                        max_qty_per_order: row.max_qty_per_order,
                        sort_order: row.sort_order,
                        is_active: row.is_active,

                        base_price_paise,
                        effective_price_paise: deal_price_paise,
                        effective_discount_paise: discount_paise,

                        pack: {
                            id: pack?.id,
                            label: pack?.label,
                            base_quantity: pack?.base_quantity,
                            base_unit: pack?.base_unit,
                        },

                        product: {
                            id: product?.id,
                            name: product?.name,
                            slug: product?.slug,
                            image_url: product?.image_url,
                            unit: product?.unit,
                        },
                    };
                }),
            })),
        };
    } catch (e) {
        console.log("DEALS SERVICE ERROR:", e);
        throw new AppError("DEALS_FETCH_FAILED", "Failed to fetch deals", 500);
    }
}

module.exports = {
    getToday,
    getActiveDealsForDate,
    computeDealUnitPrice,
};
