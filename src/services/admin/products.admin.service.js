"use strict";

const { sequelize, Product, ProductPack, ProductImage } = require("../../models");
const { AppError } = require("../../utils/errors");
const fs = require("fs");
const StorageService = require("../storage.service");
const crypto = require("crypto");
const { calculatePackPricesFromProduct } = require("../pricing.service");

async function syncDynamicPacksForProduct({ product, t }) {
    const packs = await ProductPack.findAll({
        where: { product_id: product.id, pricing_mode: "dynamic" },
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    for (const pack of packs) {
        const computed = calculatePackPricesFromProduct({
            product,
            pack: { base_unit: pack.base_unit, base_quantity: pack.base_quantity },
        });

        await pack.update(
            {
                mrp_paise: computed.mrp_paise ?? null,
                selling_price_paise: computed.selling_price_paise,
            },
            { transaction: t }
        );
    }
}

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

async function createWithImages({ payload, files }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.create(payload, { transaction: t });

        if (!files?.length) {
            return { product };
        }

        // Upload each file to Supabase and build uploaded metadata
        const uploaded = [];
        for (const file of files) {
            const uploadRes = await StorageService.uploadProductImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                productId: product.id,
            });

            uploaded.push({
                storage_provider: "supabase",
                storage_path: uploadRes.path,
                image_url: uploadRes.publicUrl,
                mime_type: file.mimetype,
                size_bytes: file.size,
                original_filename: file.originalname,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (_) { }
        }

        const images = await attachUploadedImagesToProduct({ productId: product.id, uploaded, t });

        return { product, images };
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
                unit: payload.unit ?? product.unit,

                base_quantity: payload.base_quantity, // ✅ must be passed
                mrp_paise: payload.mrp_paise, // ✅ must be passed
                selling_price_paise: payload.selling_price_paise, // ✅ must be passed

                is_active: payload.is_active ?? product.is_active,
                is_out_of_stock: payload.is_out_of_stock ?? product.is_out_of_stock,
            },
            { transaction: t }
        );

        await syncDynamicPacksForProduct({ product, t });

        return { product };
    });
}

async function updateWithImages({ productId, payload, files }) {
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

                base_quantity: payload.base_quantity,
                mrp_paise: payload.mrp_paise,
                selling_price_paise: payload.selling_price_paise,

                is_active: payload.is_active ?? product.is_active,
                is_out_of_stock: payload.is_out_of_stock ?? product.is_out_of_stock,
            },
            { transaction: t }
        );

        await syncDynamicPacksForProduct({ product, t });

        if (!files?.length) {
            return { product };
        }

        const uploaded = [];
        for (const file of files) {
            const uploadRes = await StorageService.uploadProductImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                productId: product.id,
            });

            uploaded.push({
                storage_provider: "supabase",
                storage_path: uploadRes.path,
                image_url: uploadRes.publicUrl,
                mime_type: file.mimetype,
                size_bytes: file.size,
                original_filename: file.originalname,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (_) { }
        }

        const images = await attachUploadedImagesToProduct({ productId: product.id, uploaded, t });
        return { product, images };
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

        // Decide whether to use manual prices or computed prices
        const hasMrp = payload.mrp_paise !== undefined && payload.mrp_paise !== null && payload.mrp_paise !== "";
        const hasSelling =
            payload.selling_price_paise !== undefined &&
            payload.selling_price_paise !== null &&
            payload.selling_price_paise !== "";

        let mrpToSave;
        let sellingToSave;

        const pricingMode = (hasMrp || hasSelling) ? "manual" : "dynamic";

        if (hasMrp || hasSelling) {
            // Use provided values (if one missing, we can compute that one OR keep null)
            // Here: if selling missing but mrp provided => compute selling dynamically (and vice versa)
            const computed = calculatePackPricesFromProduct({
                product,
                pack: { base_unit: payload.base_unit, base_quantity: payload.base_quantity },
            });

            if (hasMrp) {
                const n = Number(payload.mrp_paise);
                if (!Number.isFinite(n) || n < 0) {
                    throw new AppError("INVALID_PRICE", "Pack mrp_paise is invalid", 400);
                }
                mrpToSave = Math.round(n);
            } else {
                mrpToSave = computed.mrp_paise ?? null;
            }

            if (hasSelling) {
                const n = Number(payload.selling_price_paise);
                if (!Number.isFinite(n) || n < 0) {
                    throw new AppError("INVALID_PRICE", "Pack selling_price_paise is invalid", 400);
                }
                sellingToSave = Math.round(n);
            } else {
                sellingToSave = computed.selling_price_paise;
            }
        } else {
            // Fully dynamic
            const computed = calculatePackPricesFromProduct({
                product,
                pack: { base_unit: payload.base_unit, base_quantity: payload.base_quantity },
            });
            mrpToSave = computed.mrp_paise ?? null;
            sellingToSave = computed.selling_price_paise;
        }

        const pack = await ProductPack.create(
            {
                product_id: productId,
                label: payload.label,
                base_quantity: payload.base_quantity,
                base_unit: payload.base_unit,
                mrp_paise: mrpToSave,
                selling_price_paise: sellingToSave,
                pricing_mode: pricingMode,
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

        const product = await Product.findByPk(pack.product_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found for this pack", 404);
        }

        const nextBaseUnit = payload.base_unit ?? pack.base_unit;
        const nextBaseQty = payload.base_quantity ?? pack.base_quantity;

        const computed = calculatePackPricesFromProduct({
            product,
            pack: { base_unit: nextBaseUnit, base_quantity: nextBaseQty },
        });

        const hasMrp = payload.mrp_paise !== undefined && payload.mrp_paise !== null && payload.mrp_paise !== "";
        const hasSelling =
            payload.selling_price_paise !== undefined &&
            payload.selling_price_paise !== null &&
            payload.selling_price_paise !== "";

        const nextPricingMode = (hasMrp || hasSelling) ? "manual" : "dynamic";

        let mrpToSave = null;
        let sellingToSave = null;

        if (nextPricingMode === "manual") {
            // if one is missing, compute it (same behavior as createPack)
            mrpToSave = hasMrp ? Math.round(Number(payload.mrp_paise)) : (computed.mrp_paise ?? null);
            sellingToSave = hasSelling ? Math.round(Number(payload.selling_price_paise)) : computed.selling_price_paise;
        } else {
            mrpToSave = computed.mrp_paise ?? null;
            sellingToSave = computed.selling_price_paise;
        }

        await pack.update(
            {
                label: payload.label ?? pack.label,
                base_quantity: nextBaseQty,
                base_unit: nextBaseUnit,
                mrp_paise: mrpToSave,
                selling_price_paise: sellingToSave,
                pricing_mode: nextPricingMode,
                sort_order: payload.sort_order ?? pack.sort_order,
                is_active: payload.is_active ?? pack.is_active,
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

async function listPacks({ productId, includeInactive }) {
    const where = { product_id: productId };
    if (!includeInactive) where.is_active = true;

    const packs = await ProductPack.findAll({
        where,
        order: [["sort_order", "ASC"], ["created_at", "ASC"]],
    });

    return { packs };
}


// Images
async function addProductImage({ productId, payload }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        let sortOrder = payload.sort_order;

        if (sortOrder === null || sortOrder === undefined) {
            const last = await ProductImage.findOne({
                where: { product_id: productId },
                order: [["sort_order", "DESC"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            sortOrder = (last?.sort_order ?? 0) + 1;
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
    if (!uploaded?.length) return [];

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
        is_primary: startSort + idx === 1,
        created_at: new Date(),
        updated_at: new Date(),
    }));

    await ProductImage.bulkCreate(rows, { transaction: t });

    return rows;
}

async function uploadImagesToProduct({ productId, files }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        const uploaded = [];
        for (const file of files) {
            const uploadRes = await StorageService.uploadProductImage({
                localFilePath: file.path,
                fileName: file.filename,
                mimeType: file.mimetype,
                productId: product.id,
            });

            uploaded.push({
                storage_provider: "supabase",
                storage_path: uploadRes.path,
                image_url: uploadRes.publicUrl,
                mime_type: file.mimetype,
                size_bytes: file.size,
                original_filename: file.originalname,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (_) { }
        }

        const images = await attachUploadedImagesToProduct({ productId, uploaded, t });
        return { images };
    });
}

async function reorderProductImages({ productId, payload }) {

    console.log('productId : ', productId);
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

async function deleteProduct({ productId }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);

        // Soft delete (safe for orders/history)
        await product.update({ is_active: false }, { transaction: t });

        // Optionally delete all image rows (and stored objects best-effort)
        const images = await ProductImage.findAll({ where: { product_id: productId }, transaction: t, lock: t.LOCK.UPDATE });

        for (const img of images) {
            await StorageService.deleteStoredObject({
                provider: img.storage_provider,
                storagePath: img.storage_path,
                imageUrl: img.image_url,
            });
        }

        await ProductImage.destroy({ where: { product_id: productId }, transaction: t });

        return { deleted: true };
    });
}

module.exports = {
    createProduct,
    createWithImages,
    updateProduct,
    updateWithImages,
    setProductActive,

    deleteProduct,

    createPack,
    updatePack,
    setPackActive,
    deletePack,
    listPacks,

    // Images
    addProductImage,
    uploadImagesToProduct,
    updateProductImage,
    deleteProductImage,
    reorderProductImages,
};
