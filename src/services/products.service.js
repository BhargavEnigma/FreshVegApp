"use strict";

const { Op } = require("sequelize");
const { Product, Category, ProductImage, ProductPack } = require("../models");
const { AppError } = require("../utils/errors");
const StorageService = require("./storage.service");

async function list({ query }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where = { is_active: true };

    if (query.category_id) {
        where.category_id = query.category_id;
    }

    if (!query.include_out_of_stock) {
        where.is_out_of_stock = false;
    }

    if (query.q) {
        where.name = { [Op.iLike]: `%${query.q}%` };
    }

    const { rows, count } = await Product.findAndCountAll({
        where,
        include: [
            { model: Category, as: "category", required: false },
            { model: ProductImage, as: "images", required: false },
            {
                model: ProductPack,
                as: "packs",
                required: false,
                where: { is_active: true },
            },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
    });

    const products = await Promise.all(
        rows.map(async (p) => {
            const json = p.toJSON();

            if (Array.isArray(json.packs)) {
                json.packs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            }

            if (Array.isArray(json.images)) {
                json.images.sort((a, b) => {
                    const soA = a.sort_order ?? 0;
                    const soB = b.sort_order ?? 0;
                    if (soA !== soB) return soA - soB;
                    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
                });
            }

            return json;
        })
    );

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
            { model: Category, as: "category", required: false },
            { model: ProductImage, as: "images", required: false },
            {
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

    if (Array.isArray(productJson.images)) {
        productJson.images.sort((a, b) => {
            const soA = a.sort_order ?? 0;
            const soB = b.sort_order ?? 0;
            if (soA !== soB) return soA - soB;
            return String(a.created_at || "").localeCompare(String(b.created_at || ""));
        });
    }

    return { product: productJson };
}

module.exports = {
    list,
    getById,
};
