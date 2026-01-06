"use strict";

const { sequelize, Product, ProductPack } = require("../../models");
const { AppError } = require("../../utils/errors");

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

module.exports = {
    createProduct,
    updateProduct,
    setProductActive,
    createPack,
    updatePack,
    setPackActive,
    deletePack,
};
