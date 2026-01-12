"use strict";

const { sequelize, Product, ProductPack, ProductImage } = require("../../models");
const { AppError } = require("../../utils/errors");
const fs = require("fs");
const {
    getPublicUrlForRelativePath,
    isLocalUploadUrl,
    localPathFromUploadUrl,
} = require("../../utils/uploads");
const StorageService = require("../storage.service");

async function createProduct({ payload }) {
    return sequelize.transaction(async (t) => {
        const row = await Product.create(
            {
                category_id: payload.category_id,
                name: payload.name,
                description: payload.description ?? null,
                unit: payload.unit ?? null,

                base_quantity: payload.base_quantity,          // ✅ must be passed
                mrp_paise: payload.mrp_paise,                  // ✅ must be passed
                selling_price_paise: payload.selling_price_paise, // ✅ must be passed

                is_active: payload.is_active ?? true,
                is_out_of_stock: payload.is_out_of_stock ?? false,
            },
            { transaction: t }
        );

        return { product: row };
    });
}

async function updateProduct({ productId, payload }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        await product.update(
            {
                category_id: payload.category_id ?? product.category_id,
                name: payload.name ?? product.name,
                description: payload.description ?? product.description,
                unit: payload.unit ?? null,

                base_quantity: payload.base_quantity, // ✅ must be passed
                mrp_paise: payload.mrp_paise, // ✅ must be passed
                selling_price_paise: payload.selling_price_paise, // ✅ must be passed

                is_active: payload.is_active ?? true,
                is_out_of_stock: payload.is_out_of_stock ?? false,
            },
            { transaction: t }
        );

        return { product };
    });
}

async function setProductActive({ productId, is_active }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        await product.update({ is_active: !!is_active }, { transaction: t });

        return { product: { id: product.id, is_active: product.is_active } };
    });
}

// Packs
async function createPack({ productId, payload }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product || !product.is_active) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        const exists = await ProductPack.findOne({
            where: { product_id: productId, label: payload.label },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (exists) {
            throw new AppError("PACK_ALREADY_EXISTS", "Pack with same label already exists", 400);
        }

        const pack = await ProductPack.create(
            {
                product_id: productId,
                label: payload.label,
                base_quantity: payload.base_quantity,
                base_unit: payload.base_unit,
                mrp_paise: payload.mrp ? Math.round(Number(payload.mrp_paise) * 100) : null,
                selling_price_paise: Math.round(Number(payload.selling_price_paise) * 100),
                sort_order: payload.sort_order ?? 0,
                is_active: payload.is_active ?? true,
            },
            { transaction: t }
        );

        return { pack };
    });
}

async function updatePack({ packId, payload }) {
    return sequelize.transaction(async (t) => {
        const pack = await ProductPack.findByPk(packId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!pack) {
            throw new AppError("PACK_NOT_FOUND", "Pack not found", 404);
        }

        await pack.update(
            {
                label: payload.label ?? pack.label,
                base_quantity: payload.base_quantity ?? pack.base_quantity,
                base_unit: payload.base_unit ?? pack.base_unit,
                mrp_paise: payload.mrp !== undefined ? (payload.mrp === null ? null : Math.round(Number(payload.mrp) * 100)) : pack.mrp_paise,
                selling_price_paise: payload.price !== undefined ? Math.round(Number(payload.price) * 100) : pack.selling_price_paise,
                sort_order: payload.sort_order ?? pack.sort_order,
            },
            { transaction: t }
        );

        return { pack };
    });
}

async function setPackActive({ packId, is_active }) {
    return sequelize.transaction(async (t) => {
        const pack = await ProductPack.findByPk(packId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!pack) {
            throw new AppError("PACK_NOT_FOUND", "Pack not found", 404);
        }

        await pack.update({ is_active: !!is_active }, { transaction: t });

        return { pack: { id: pack.id, is_active: pack.is_active } };
    });
}

async function deletePack({ packId }) {
    return sequelize.transaction(async (t) => {
        const pack = await ProductPack.findByPk(packId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!pack) {
            throw new AppError("PACK_NOT_FOUND", "Pack not found", 404);
        }

        await pack.destroy({ transaction: t });

        return { deleted: true };
    });
}

// Images
async function addProductImage({ productId, payload }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        // Auto-assign sort_order if not provided: append after last
        let sortOrder = payload.sort_order;
        if (sortOrder === null || sortOrder === undefined) {
            const maxRow = await ProductImage.findOne({
                where: { product_id: productId },
                attributes: [[sequelize.fn("MAX", sequelize.col("sort_order")), "max_sort_order"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
                raw: true,
            });
            const maxSort = Number(maxRow?.max_sort_order);
            sortOrder = Number.isFinite(maxSort) ? maxSort + 1 : 0;
        }

        const image = await ProductImage.create(
            {
                product_id: productId,
                image_url: payload.image_url,
                sort_order: sortOrder,
            },
            { transaction: t }
        );

        return { image };
    });
}

async function updateProductImage({ imageId, payload }) {
    return sequelize.transaction(async (t) => {
        const image = await ProductImage.findByPk(imageId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!image) {
            throw new AppError("IMAGE_NOT_FOUND", "Product image not found", 404);
        }

        await image.update(
            {
                image_url: payload.image_url ?? image.image_url,
                sort_order: payload.sort_order ?? image.sort_order,
            },
            { transaction: t }
        );

        return { image };
    });
}

async function deleteProductImage({ imageId }) {
    return sequelize.transaction(async (t) => {
        const image = await ProductImage.findByPk(imageId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!image) {
            throw new AppError("IMAGE_NOT_FOUND", "Product image not found", 404);
        }
        // Best-effort: delete stored object (local or supabase) before deleting DB row.
        await StorageService.deleteStoredObject({
            provider: image.storage_provider,
            storagePath: image.storage_path,
            imageUrl: image.image_url,
        });


        await image.destroy({ transaction: t });

        return { deleted: true };
    });
}

async function attachUploadedImagesToProduct({ productId, uploaded, t }) {
    // uploaded = [{ storage_provider, storage_path, image_url, mime_type, size_bytes, original_filename }, ...]
    if (!uploaded?.length) return [];

    // ✅ FIX: Postgres doesn't allow FOR UPDATE with aggregate functions like MAX().
    // So we lock the last row by ordering instead of using MAX().
    const last = await ProductImage.findOne({
        where: { product_id: productId },
        order: [["sort_order", "DESC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    const startSort = (last?.sort_order ?? 0) + 1;

    const rows = uploaded.map((u, idx) => ({
        id: crypto.randomUUID(),
        product_id: productId,
        storage_provider: u.storage_provider || "supabase",
        storage_path: u.storage_path || null,
        image_url: u.image_url || null,
        mime_type: u.mime_type || null,
        size_bytes: u.size_bytes || null,
        original_filename: u.original_filename || null,
        sort_order: startSort + idx,
        is_primary: startSort + idx === 1, // keep your existing rule if you have one
        created_at: new Date(),
        updated_at: new Date(),
    }));

    await ProductImage.bulkCreate(rows, { transaction: t });

    return rows;
}

async function createProductWithImages({ payload, files }) {
    return sequelize.transaction(async (t) => {
        const row = await Product.create(
            {
                category_id: payload.category_id,
                name: payload.name,
                description: payload.description ?? null,
                unit: payload.unit ?? null,

                base_quantity: payload.base_quantity,
                mrp_paise: payload.mrp_paise,
                selling_price_paise: payload.selling_price_paise,

                is_active: payload.is_active ?? true,
                is_out_of_stock: payload.is_out_of_stock ?? false,
            },
            { transaction: t }
        );

        const images = await attachUploadedImagesToProduct({ productId: row.id, files, t });

        return { product: row, images };
    });
}

async function uploadProductImages({ productId, files }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        const images = await attachUploadedImagesToProduct({ productId, files, t });
        return { images };
    });
}

async function reorderProductImages({ productId, payload }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        const ids = payload.images.map((x) => x.id);

        const rows = await ProductImage.findAll({
            where: { product_id: productId, id: ids },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (rows.length !== ids.length) {
            throw new AppError("IMAGE_NOT_FOUND", "One or more images not found for this product", 404);
        }

        // Apply updates
        const map = new Map(payload.images.map((x) => [x.id, x.sort_order]));
        for (const row of rows) {
            await row.update({ sort_order: map.get(row.id) }, { transaction: t });
        }

        // Return ordered list
        const images = await ProductImage.findAll({
            where: { product_id: productId },
            order: [["sort_order", "ASC"], ["created_at", "ASC"]],
            transaction: t,
        });

        return { images };
    });
}

module.exports = {
    createProduct,
    createProductWithImages,
    updateProduct,
    setProductActive,
    createPack,
    updatePack,
    setPackActive,
    deletePack,
    // Images
    addProductImage,
    uploadProductImages,
    updateProductImage,
    deleteProductImage,
    reorderProductImages,
};
