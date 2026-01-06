"use strict";

const { Op } = require("sequelize");
const { Category } = require("../models");
const { slugify } = require("../utils/slugify");

function normalizeName(name) {
    return String(name).trim();
}

async function ensureUniqueNameAndSlug({ name, slug, excludeId = null }) {
    const whereName = excludeId ? { name, id: { [Op.ne]: excludeId } } : { name };
    const whereSlug = excludeId ? { slug, id: { [Op.ne]: excludeId } } : { slug };

    const [nameHit, slugHit] = await Promise.all([
        Category.findOne({ where: whereName }),
        Category.findOne({ where: whereSlug }),
    ]);

    if (nameHit) {
        const err = new Error("Category name already exists");
        err.code = "CATEGORY_NAME_EXISTS";
        throw err;
    }

    if (slugHit) {
        const err = new Error("Category slug already exists");
        err.code = "CATEGORY_SLUG_EXISTS";
        throw err;
    }
}

async function listPublic({ q = null }) {
    const where = { is_active: true };

    if (q) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${q}%` } },
            { slug: { [Op.iLike]: `%${q}%` } },
        ];
    }

    return Category.findAll({
        where,
        order: [
            ["sort_order", "ASC"],
            ["name", "ASC"],
        ],
        attributes: ["id", "name", "slug", "is_active", "sort_order"],
    });
}

async function listOps({ q = null, include_inactive = false }) {
    const where = {};

    if (!include_inactive) {
        where.is_active = true;
    }

    if (q) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${q}%` } },
            { slug: { [Op.iLike]: `%${q}%` } },
        ];
    }

    return Category.findAll({
        where,
        order: [
            ["sort_order", "ASC"],
            ["name", "ASC"],
        ],
        attributes: ["id", "name", "slug", "is_active", "sort_order", "created_at", "updated_at"],
    });
}

async function getById(id) {
    const row = await Category.findByPk(id);
    if (!row) {
        const err = new Error("Category not found");
        err.code = "CATEGORY_NOT_FOUND";
        throw err;
    }
    return row;
}

async function create({ name, slug = null, is_active = true, sort_order = null }) {
    const cleanName = normalizeName(name);
    const finalSlug = slugify(slug || cleanName);

    await ensureUniqueNameAndSlug({ name: cleanName, slug: finalSlug });

    const row = await Category.create({
        name: cleanName,
        slug: finalSlug,
        is_active: is_active ?? true,
        sort_order,
    });

    return row;
}

async function update(id, payload) {
    const row = await getById(id);

    const updates = {};

    if (payload.name !== undefined && payload.name !== null) {
        updates.name = normalizeName(payload.name);
    }

    if (payload.slug !== undefined && payload.slug !== null) {
        updates.slug = slugify(payload.slug);
    }

    if (payload.is_active !== undefined && payload.is_active !== null) {
        updates.is_active = payload.is_active;
    }

    if (payload.sort_order !== undefined && payload.sort_order !== null) {
        updates.sort_order = payload.sort_order;
    }

    // If name changed but slug not provided, keep slug stable (SEO-friendly).
    // If you want auto-regenerate slug on name change, set updates.slug = slugify(updates.name).

    const finalName = updates.name ?? row.name;
    const finalSlug = updates.slug ?? row.slug;

    await ensureUniqueNameAndSlug({ name: finalName, slug: finalSlug, excludeId: id });

    await row.update({
        ...updates,
    });

    return row;
}

async function toggleActive(id, is_active) {
    const row = await getById(id);
    await row.update({ is_active: !!is_active });
    return row;
}

async function reorder(items, sequelize) {
    // Optional: pass sequelize transaction from controller if you prefer
    const t = sequelize ? await sequelize.transaction() : null;

    try {
        const ids = items.map((x) => x.id);
        const rows = await Category.findAll({
            where: { id: { [Op.in]: ids } },
            transaction: t || undefined,
        });

        if (rows.length !== ids.length) {
            const err = new Error("One or more categories not found");
            err.code = "CATEGORY_NOT_FOUND";
            throw err;
        }

        const map = new Map(items.map((x) => [x.id, x.sort_order]));

        for (const r of rows) {
            await r.update({ sort_order: map.get(r.id) }, { transaction: t || undefined });
        }

        if (t) await t.commit();

        return true;
    } catch (e) {
        if (t) await t.rollback();
        throw e;
    }
}

module.exports = {
    listPublic,
    listOps,
    getById,
    create,
    update,
    toggleActive,
    reorder,
};
