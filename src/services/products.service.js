"use strict";

const { Op } = require("sequelize");
const { Product, Category, ProductImage, ProductPack } = require("../models");
const { AppError } = require("../utils/errors");

async function list({ query }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where = { is_active: true };

    if (query.category_id) {
        where.category_id = query.category_id;
    }

    if (!query.include_out_of_stock) {
        // Keeping your current product-level out-of-stock flag
        // (Later, if you add pack-level stock, we can change this logic)
        where.is_out_of_stock = false;
    }

    if (query.q) {
        where.name = { [Op.iLike]: `%${query.q}%` };
    }

    const { rows, count } = await Product.findAndCountAll({
        where,
        include: [
            {
                model: Category,
                as: "category",
                required: false,
            },
            {
                model: ProductImage,
                as: "images",
                required: false,
            },
            {
                // ✅ Blueprint v1.2 alignment: return packs with each product
                model: ProductPack,
                as: "packs",
                required: false,
                where: { is_active: true },
            },
        ],
        // Important: ordering packs inside include is not supported reliably by Sequelize on all dialects.
        // So we sort packs after fetch.
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true, // ✅ Important for correct count when using hasMany include
    });

    const products = rows.map((p) => {
        const json = p.toJSON();
        if (Array.isArray(json.packs)) {
            json.packs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }
        return json;
    });

    return {
        products,
        page,
        limit,
        total: count,
    };
}

async function getById({ productId }) {
    const product = await Product.findOne({
        where: { id: productId, is_active: true },
        include: [
            {
                model: Category,
                as: "category",
                required: false,
            },
            {
                model: ProductImage,
                as: "images",
                required: false,
            },
            {
                // ✅ Blueprint v1.2 alignment
                model: ProductPack,
                as: "packs",
                required: false,
                where: { is_active: true },
            },
        ],
    });

    if (!product) {
        throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
    }

    const productJson = product.toJSON();
    if (Array.isArray(productJson.packs)) {
        productJson.packs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    return { product: productJson };
}

module.exports = {
    list,
    getById,
};
