"use strict";

const fs = require("fs");
const { Op } = require("sequelize");

const { sequelize, Banner } = require("../../models");
const { AppError } = require("../../utils/errors");
const StorageService = require("../storage.service");

async function list({ placement }) {
    const where = {};
    if (placement) where.placement = placement;

    const rows = await Banner.findAll({
        where,
        order: [
            ["placement", "ASC"],
            ["sort_order", "ASC"],
            ["created_at", "DESC"],
        ],
    });

    return {
        count: rows.length,
        banners: rows,
    };
}

async function create({ payload }) {
    return sequelize.transaction(async (t) => {
        if (!payload.image_url) {
            throw new AppError("IMAGE_URL_REQUIRED", "image_url is required when not uploading file", 400);
        }

        const row = await Banner.create(
            {
                title: payload.title ?? null,
                subtitle: payload.subtitle ?? null,
                image_url: payload.image_url,

                placement: payload.placement ?? "home",
                action_type: payload.action_type ?? "none",
                action_value: payload.action_value ?? null,

                sort_order: payload.sort_order ?? 0,
                start_at: payload.start_at ? new Date(payload.start_at) : null,
                end_at: payload.end_at ? new Date(payload.end_at) : null,
                is_active: payload.is_active ?? true,
            },
            { transaction: t }
        );

        return { banner: row };
    });
}

async function createWithImage({ payload, file }) {
    return sequelize.transaction(async (t) => {
        if (!file) {
            throw new AppError("IMAGE_REQUIRED", "banner image file is required", 400);
        }

        // Create row first to get bannerId for storage path
        const row = await Banner.create(
            {
                title: payload.title ?? null,
                subtitle: payload.subtitle ?? null,
                image_url: "__PENDING__",

                placement: payload.placement ?? "home",
                action_type: payload.action_type ?? "none",
                action_value: payload.action_value ?? null,

                sort_order: payload.sort_order ?? 0,
                start_at: payload.start_at ? new Date(payload.start_at) : null,
                end_at: payload.end_at ? new Date(payload.end_at) : null,
                is_active: payload.is_active ?? true,
            },
            { transaction: t }
        );

        const uploadRes = await StorageService.uploadBannerImage({
            localFilePath: file.path,
            fileName: file.filename,
            mimeType: file.mimetype,
            bannerId: row.id,
        });

        try {
            fs.unlinkSync(file.path);
        } catch (_) { }

        await row.update(
            {
                storage_provider: "supabase",
                storage_path: uploadRes.path,
                image_url: uploadRes.publicUrl,
            },
            { transaction: t }
        );

        return { banner: row };
    });
}

async function update({ bannerId, payload }) {
    return sequelize.transaction(async (t) => {
        const row = await Banner.findByPk(bannerId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!row) throw new AppError("BANNER_NOT_FOUND", "Banner not found", 404);

        await row.update(
            {
                title: payload.title ?? row.title,
                subtitle: payload.subtitle ?? row.subtitle,
                image_url: payload.image_url ?? row.image_url,

                placement: payload.placement ?? row.placement,
                action_type: payload.action_type ?? row.action_type,
                action_value: payload.action_value ?? row.action_value,

                sort_order: payload.sort_order ?? row.sort_order,
                start_at: payload.start_at === undefined ? row.start_at : (payload.start_at ? new Date(payload.start_at) : null),
                end_at: payload.end_at === undefined ? row.end_at : (payload.end_at ? new Date(payload.end_at) : null),
                is_active: payload.is_active ?? row.is_active,
            },
            { transaction: t }
        );

        return { banner: row };
    });
}

async function updateWithImage({ bannerId, payload, file }) {
    return sequelize.transaction(async (t) => {
        const row = await Banner.findByPk(bannerId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!row) throw new AppError("BANNER_NOT_FOUND", "Banner not found", 404);

        let uploaded = null;

        if (file) {
            uploaded = await StorageService.uploadBannerImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                bannerId: row.id,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (_) { }
        }

        const oldProvider = row.storage_provider;
        const oldPath = row.storage_path;

        await row.update(
            {
                title: payload.title ?? row.title,
                subtitle: payload.subtitle ?? row.subtitle,

                placement: payload.placement ?? row.placement,
                action_type: payload.action_type ?? row.action_type,
                action_value: payload.action_value ?? row.action_value,

                sort_order: payload.sort_order ?? row.sort_order,
                start_at: payload.start_at === undefined ? row.start_at : (payload.start_at ? new Date(payload.start_at) : null),
                end_at: payload.end_at === undefined ? row.end_at : (payload.end_at ? new Date(payload.end_at) : null),
                is_active: payload.is_active ?? row.is_active,

                ...(uploaded
                    ? {
                        storage_provider: "supabase",
                        storage_path: uploaded.path,
                        image_url: uploaded.publicUrl,
                    }
                    : {}),
            },
            { transaction: t }
        );

        // Best-effort delete old stored image if replaced
        if (uploaded && oldProvider === "supabase" && oldPath) {
            await StorageService.deleteStoredObject({ provider: oldProvider, storagePath: oldPath });
        }

        return { banner: row };
    });
}

async function setActive({ bannerId, is_active }) {
    return sequelize.transaction(async (t) => {
        const row = await Banner.findByPk(bannerId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!row) throw new AppError("BANNER_NOT_FOUND", "Banner not found", 404);

        await row.update({ is_active: Boolean(is_active) }, { transaction: t });
        return { banner: row };
    });
}

async function remove({ bannerId }) {
    return sequelize.transaction(async (t) => {
        const row = await Banner.findByPk(bannerId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!row) throw new AppError("BANNER_NOT_FOUND", "Banner not found", 404);

        const provider = row.storage_provider;
        const storagePath = row.storage_path;

        await row.destroy({ transaction: t });

        if (provider === "supabase" && storagePath) {
            await StorageService.deleteStoredObject({ provider, storagePath });
        }

        return { deleted: true };
    });
}

async function reorder({ ids }) {
    return sequelize.transaction(async (t) => {
        const rows = await Banner.findAll({
            where: { id: { [Op.in]: ids } },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        const foundIds = new Set(rows.map((r) => r.id));
        for (const id of ids) {
            if (!foundIds.has(id)) {
                throw new AppError("BANNER_NOT_FOUND", `Banner not found: ${id}`, 404);
            }
        }

        // Set sort_order by array index
        for (let i = 0; i < ids.length; i++) {
            await Banner.update(
                { sort_order: i },
                { where: { id: ids[i] }, transaction: t }
            );
        }

        return { updated: true };
    });
}

module.exports = {
    list,
    create,
    createWithImage,
    update,
    updateWithImage,
    setActive,
    remove,
    reorder,
};
