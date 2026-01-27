"use strict";

const fs = require("fs");
const { Op, fn, col } = require("sequelize");
const { Category, Product, sequelize } = require("../models");
const { slugify } = require("../utils/slugify");
const StorageService = require("./storage.service");

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

    const rows = await Category.findAll({
        where,
        include: [
            {
                model: Product,
                as: "products",
                required: false,
                attributes: [],
                where: { is_active: true, is_out_of_stock: false },
            },
        ],
        order: [
            ["sort_order", "ASC"],
            ["name", "ASC"],
        ],
        attributes: [
            "id",
            "name",
            "slug",
            "is_active",
            "sort_order",
            "image_url",
            [fn("COUNT", col("products.id")), "products_count"],
        ],
        group: ["Category.id"],
    });

    return rows.map((r) => {
        const json = r.toJSON();
        json.products_count = Number(json.products_count || 0);
        return json;
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

    const rows = await Category.findAll({
        where,
        include: [
            {
                model: Product,
                as: "products",
                required: false,
                attributes: [],
                where: { is_active: true },
            },
        ],
        order: [
            ["sort_order", "ASC"],
            ["name", "ASC"],
        ],
        attributes: [
            "id",
            "name",
            "slug",
            "is_active",
            "sort_order",
            "image_url",
            "created_at",
            "updated_at",
            [fn("COUNT", col("products.id")), "products_count"],
        ],
        group: ["Category.id"],
    });

    return rows.map((r) => {
        const json = r.toJSON();
        json.products_count = Number(json.products_count || 0);
        return json;
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

async function create({ payload, file }) {
    return sequelize.transaction(async (t) => {
        const cleanName = normalizeName(payload.name);
        const finalSlug = slugify(payload.slug || cleanName);

        await ensureUniqueNameAndSlug({ name: cleanName, slug: finalSlug });

        const row = await Category.create(
            {
                name: cleanName,
                slug: finalSlug,
                is_active: payload.is_active ?? true,
                sort_order: payload.sort_order ?? null,

                // allow manual url when no file
                image_url: payload.image_url ?? null,
                storage_provider: null,
                storage_path: null,
            },
            { transaction: t }
        );

        // if file uploaded => upload to supabase and update category
        if (file) {
            const uploaded = await StorageService.uploadCategoryImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                categoryId: row.id,
            });

            try { fs.unlinkSync(file.path); } catch (_) {}

            await row.update(
                {
                    storage_provider: "supabase",
                    storage_path: uploaded.path,
                    image_url: uploaded.publicUrl,
                },
                { transaction: t }
            );
        }

        return row;
    });
}

async function update({ categoryId, payload, file }) {
    return sequelize.transaction(async (t) => {
        const row = await Category.findByPk(categoryId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!row) {
            const err = new Error("Category not found");
            err.code = "CATEGORY_NOT_FOUND";
            throw err;
        }

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

        // manual image_url update (only used when no file is uploaded)
        if (!file && payload.image_url !== undefined) {
            updates.image_url = payload.image_url;

            if (payload.image_url === null) {
                updates.storage_provider = null;
                updates.storage_path = null;
            }
        }

        const finalName = updates.name ?? row.name;
        const finalSlug = updates.slug ?? row.slug;

        await ensureUniqueNameAndSlug({ name: finalName, slug: finalSlug, excludeId: categoryId });

        // upload file if provided
        if (file) {
            const oldProvider = row.storage_provider;
            const oldPath = row.storage_path;

            const uploaded = await StorageService.uploadCategoryImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                categoryId: row.id,
            });

            try { fs.unlinkSync(file.path); } catch (_) {}

            updates.storage_provider = "supabase";
            updates.storage_path = uploaded.path;
            updates.image_url = uploaded.publicUrl;

            // delete old object after successful update (best effort)
            if (oldProvider === "supabase" && oldPath) {
                await StorageService.deleteStoredObject({ provider: oldProvider, storagePath: oldPath });
            }
        }

        await row.update({ ...updates }, { transaction: t });

        return row;
    });
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
