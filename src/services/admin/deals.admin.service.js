"use strict";

const { Op } = require("sequelize");

const { Deal, DealItem, ProductPack, Product, sequelize } = require("../../models");
const { AppError } = require("../../utils/errors");
const { computeDealUnitPrice } = require("../deals.service");

function assertPricingRule(item) {
    const t = String(item.pricing_type || "fixed_price");

    if (t === "fixed_price") {
        if (item.deal_price_paise === null || item.deal_price_paise === undefined) {
            throw new AppError("INVALID_DEAL_ITEM", "deal_price_paise is required for fixed_price", 400);
        }
    }

    if (t === "percent_off") {
        if (item.discount_bps === null || item.discount_bps === undefined) {
            throw new AppError("INVALID_DEAL_ITEM", "discount_bps is required for percent_off", 400);
        }
    }

    if (t === "amount_off") {
        if (item.discount_paise === null || item.discount_paise === undefined) {
            throw new AppError("INVALID_DEAL_ITEM", "discount_paise is required for amount_off", 400);
        }
    }
}

async function list({ from, to, active }) {
    const where = {};
    if (from && to) {
        where.deal_date = { [Op.between]: [from, to] };
    } else if (from) {
        where.deal_date = { [Op.gte]: from };
    } else if (to) {
        where.deal_date = { [Op.lte]: to };
    }
    if (active !== undefined && active !== null) {
        where.is_active = active;
    }

    const deals = await Deal.findAll({
        where,
        order: [
            ["deal_date", "DESC"],
            ["priority", "DESC"],
            ["created_at", "DESC"],
        ],
    });

    return {
        deals: deals.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            deal_date: d.deal_date,
            starts_at: d.starts_at,
            ends_at: d.ends_at,
            is_active: d.is_active,
            priority: d.priority,
            created_at: d.created_at,
            updated_at: d.updated_at,
        })),
    };
}

async function getById({ dealId }) {
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
        throw new AppError("DEAL_NOT_FOUND", "Deal not found", 404);
    }

    const items = await DealItem.findAll({
        where: { deal_id: deal.id },
        include: [
            {
                model: ProductPack,
                as: "pack",
                required: true,
                include: [{ model: Product, as: "product", required: true }],
            },
        ],
        order: [
            ["sort_order", "ASC"],
            ["created_at", "ASC"],
        ],
    });

    return {
        deal: {
            id: deal.id,
            name: deal.name,
            description: deal.description,
            deal_date: deal.deal_date,
            starts_at: deal.starts_at,
            ends_at: deal.ends_at,
            is_active: deal.is_active,
            priority: deal.priority,
            created_at: deal.created_at,
            updated_at: deal.updated_at,
        },
        items: items.map((row) => {
            const base_price_paise = Number(row.pack?.selling_price_paise ?? 0);
            const effective = computeDealUnitPrice({ basePricePaise: base_price_paise, dealItem: row });
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
                effective_price_paise: effective,
                pack: {
                    id: row.pack?.id,
                    label: row.pack?.label,
                    base_quantity: row.pack?.base_quantity,
                    base_unit: row.pack?.base_unit,
                },
                product: {
                    id: row.pack?.product?.id,
                    name: row.pack?.product?.name,
                    slug: row.pack?.product?.slug,
                    image_url: row.pack?.product?.image_url,
                },
            };
        }),
    };
}

async function create({ payload }) {
    const deal = await Deal.create({
        name: payload.name,
        description: payload.description ?? null,
        deal_date: payload.deal_date,
        starts_at: payload.starts_at ?? null,
        ends_at: payload.ends_at ?? null,
        is_active: payload.is_active,
        priority: payload.priority ?? 0,
    });

    return { deal };
}

async function update({ dealId, payload }) {
    const deal = await Deal.findByPk(dealId);
    if (!deal) throw new AppError("DEAL_NOT_FOUND", "Deal not found", 404);

    await deal.update({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.deal_date !== undefined ? { deal_date: payload.deal_date } : {}),
        ...(payload.starts_at !== undefined ? { starts_at: payload.starts_at } : {}),
        ...(payload.ends_at !== undefined ? { ends_at: payload.ends_at } : {}),
        ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    });

    return { deal };
}

async function remove({ dealId }) {
    const deal = await Deal.findByPk(dealId);
    if (!deal) throw new AppError("DEAL_NOT_FOUND", "Deal not found", 404);

    await deal.destroy();
    return { ok: true };
}

async function packSearch({ q, limit }) {
    const where = { is_active: true };
    const include = [{ model: Product, as: "product", required: true, where: { is_active: true } }];

    if (q) {
        // Search across pack label + product name/slug
        where[Op.or] = [
            { label: { [Op.iLike]: `%${q}%` } },
            { "$product.name$": { [Op.iLike]: `%${q}%` } },
            // { "$product.slug$": { [Op.iLike]: `%${q}%` } },
        ];
    }

    const packs = await ProductPack.findAll({
        where,
        include,
        order: [
            [sequelize.literal('"product"."name"'), "ASC"],
            ["label", "ASC"],
        ],
        limit: Number(limit || 20),
    });

    return {
        packs: packs.map((p) => ({
            id: p.id,
            label: p.label,
            base_quantity: p.base_quantity,
            base_unit: p.base_unit,
            selling_price_paise: p.selling_price_paise,
            mrp_paise: p.mrp_paise,
            product: {
                id: p.product?.id,
                name: p.product?.name,
                slug: p.product?.slug,
                image_url: p.product?.image_url,
            },
        })),
    };
}

async function upsertItems({ dealId, items }) {
    return sequelize.transaction(async (t) => {
        const deal = await Deal.findByPk(dealId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!deal) throw new AppError("DEAL_NOT_FOUND", "Deal not found", 404);

        // Optional: block duplicates in the same request body
        const seen = new Set();
        for (const it of items) {
            const key = `${dealId}:${it.product_pack_id}`;
            if (seen.has(key)) {
                throw new AppError(
                    "DUPLICATE_DEAL_ITEM",
                    "Same product pack is repeated in request items",
                    400,
                    { product_pack_id: it.product_pack_id }
                );
            }
            seen.add(key);
        }

        for (const it of items) {
            assertPricingRule(it);

            const payload = {
                deal_id: dealId,
                product_pack_id: it.product_pack_id,
                pricing_type: it.pricing_type,
                deal_price_paise: it.deal_price_paise ?? null,
                discount_bps: it.discount_bps ?? null,
                discount_paise: it.discount_paise ?? null,
                max_qty_per_order: it.max_qty_per_order ?? null,
                sort_order: it.sort_order ?? 0,
                is_active: it.is_active !== undefined ? it.is_active : true,
            };

            if (it.id) {
                const row = await DealItem.findOne({
                    where: { id: it.id, deal_id: dealId },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                if (!row) throw new AppError("DEAL_ITEM_NOT_FOUND", "Deal item not found", 404);
                await row.update(payload, { transaction: t });
            } else {
                // IMPORTANT: prevent unique constraint crash
                const existing = await DealItem.findOne({
                    where: { deal_id: dealId, product_pack_id: it.product_pack_id },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });

                if (existing) {
                    await existing.update(payload, { transaction: t });
                } else {
                    await DealItem.create(payload, { transaction: t });
                }
            }
        }

        return getById({ dealId });
    });
}

async function removeItem({ dealId, itemId }) {
    const row = await DealItem.findOne({ where: { id: itemId, deal_id: dealId } });
    if (!row) throw new AppError("DEAL_ITEM_NOT_FOUND", "Deal item not found", 404);
    await row.destroy();
    return { ok: true };
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove,
    packSearch,
    upsertItems,
    removeItem,
};
