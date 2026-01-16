"use strict";

const { sequelize, Cart, CartItem, Product, ProductPack, ProductImage } = require("../models");
const { AppError } = require("../utils/errors");

function toPaise(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const n = Number(value);
    if (Number.isNaN(n)) {
        return null;
    }

    return Math.round(n * 100);
}

async function getOrCreateActiveCart({ userId, t }) {
    let cart = await Cart.findOne({
        where: { user_id: userId, status: "active" },
        transaction: t,
        lock: t.LOCK.UPDATE,
        raw: true
    });

    if (!cart) {
        cart = await Cart.create(
            { user_id: userId, status: "active" },
            { transaction: t }
        );
    }

    return cart;
}

async function buildCartResponse({ cartId, t }) {
    const cart = await Cart.findOne({
        where: { id: cartId },
        include: [
            {
                model: CartItem,
                as: "items",
                include: [
                    {
                        model: Product,
                        as: "product",
                        required: false,
                        include: [{ model: ProductImage, as: "images", required: false }],
                    },
                    { 
                        model: ProductPack, 
                        as: "pack", 
                        required: true
                    }
                ],
            },
        ],
        transaction: t,
    });

    const items = (cart?.items || []).map((it) => {
        // Ensure deterministic image ordering for UI
        try {
            const json = it.toJSON();
            if (json?.product?.images && Array.isArray(json.product.images)) {
                json.product.images.sort((a, b) => {
                    const soA = a.sort_order ?? 0;
                    const soB = b.sort_order ?? 0;
                    if (soA !== soB) return soA - soB;
                    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
                });
            }
            return json;
        } catch (_e) {
            return it;
        }
    });

    let subtotal_paise = 0;
    let total_qty = 0;

    for (const it of items) {
        const qty = Number(it.quantity);
        total_qty += qty;
        subtotal_paise += Math.round(qty * Number(it.price_paise));
    }

    return {
        cart: {
            id: cart.id,
            status: cart.status,
            items,
            summary: {
                items_count: items.length,
                total_qty: total_qty,
                subtotal_paise,
            },
        },
    };
}

async function resolvePackForCart({ payload, t }) {
    // Case 1: pack id provided
    if (payload.product_pack_id) {
        console.log('PRODUCT PACK ID....');
        const pack = await ProductPack.findOne({
            where: {
                id: payload.product_pack_id,
                is_active: true,
            },
            include: [
                {
                    model: Product,
                    as: "product",
                    required: true,
                    where: {
                        is_active: true,
                    },
                },
            ],
            // raw: true,
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        console.log('PACK : ', pack);

        if (!pack) {
            throw new AppError("PACK_NOT_FOUND", "Product pack not found", 404);
        }

        if (pack.product.is_out_of_stock) {
            throw new AppError("OUT_OF_STOCK", "Product is out of stock", 400);
        }

        return {
            product: pack.product,
            pack,
        };
    }

    // Case 2: product id provided → choose default pack
    if (payload.product_id) {
        console.log('PRODUCT ID....');
        const product = await Product.findOne({
            where: {
                id: payload.product_id,
                is_active: true,
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!product) {
            throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
        }

        if (product.is_out_of_stock) {
            throw new AppError("OUT_OF_STOCK", "Product is out of stock", 400);
        }

        const pack = await ProductPack.findOne({
            where: {
                product_id: product.id,
                is_active: true,
            },
            order: [
                ["sort_order", "ASC"],
                ["created_at", "ASC"],
            ],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!pack) {
            throw new AppError(
                "PACK_NOT_FOUND",
                "No active pack found for this product",
                400
            );
        }

        return { product, pack };
    }

    throw new AppError(
        "VALIDATION_ERROR",
        "Either product_pack_id or product_id is required",
        400
    );
}

async function getMyCart({ userId }) {
    return sequelize.transaction(async (t) => {
        const cart = await getOrCreateActiveCart({ userId, t });
        return buildCartResponse({ cartId: cart.id, t });
    });
}

async function addItem({ userId, payload }) {
    return sequelize.transaction(async (t) => {
        const cart = await getOrCreateActiveCart({ userId, t });

        console.log("USER'S CART : ", cart);

        const { pack } = await resolvePackForCart({ payload, t });

        // Determine pack price in paise
        // Prefer pack.price_paise if your table has it, else use pack.price (decimal) -> paise
        const packPricePaiseRaw = pack?.selling_price_paise;

        // IMPORTANT: if selling_price_paise is a DECIMAL in DB, Sequelize might return it as string.
        // Number("2500") => 2500 (ok). Number(undefined) => NaN (bad).
        const packPricePaise = Number(packPricePaiseRaw);

        if (!Number.isFinite(packPricePaise) || packPricePaise <= 0) {
            throw new AppError(
                "INVALID_PRICE",
                `Pack price is invalid (selling_price_paise=${packPricePaiseRaw})`,
                400
            );
        }

        const qty = Number(payload.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new AppError("INVALID_QUANTITY", "Quantity must be > 0", 400);
        }

        // Uniqueness should be cart_id + product_pack_id
        const existing = await CartItem.findOne({
            where: { cart_id: cart.id, product_pack_id: pack.id },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (existing) {
            const newQty = Number(existing.quantity) + qty;

            await existing.update(
                {
                    quantity: newQty,
                    price_paise: packPricePaise,
                },
                { transaction: t }
            );
        } else {
            await CartItem.create(
                {
                    cart_id: cart.id,
                    // Keep product_id if your cart_items table still has it (useful for joins/backward)
                    product_id: pack.product_id,
                    product_pack_id: pack.id,
                    quantity: payload.quantity,
                    price_paise: packPricePaise,
                },
                { transaction: t }
            );
        }

        return buildCartResponse({ cartId: cart.id, t });
    });
}

async function updateItem({ userId, itemId, payload }) {
    return sequelize.transaction(async (t) => {
        const cart = await getOrCreateActiveCart({ userId, t });

        const item = await CartItem.findOne({
            where: { id: itemId, cart_id: cart.id },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!item) {
            throw new AppError("CART_ITEM_NOT_FOUND", "Cart item not found", 404);
        }

        await item.update(
            { quantity: payload.quantity },
            { transaction: t }
        );

        return buildCartResponse({ cartId: cart.id, t });
    });
}

async function removeItem({ userId, itemId }) {
    return sequelize.transaction(async (t) => {
        const cart = await getOrCreateActiveCart({ userId, t });

        const item = await CartItem.findOne({
            where: { id: itemId, cart_id: cart.id },
            transaction: t,
        });

        if (!item) {
            throw new AppError("CART_ITEM_NOT_FOUND", "Cart item not found", 404);
        }

        await item.destroy({ transaction: t });

        return buildCartResponse({ cartId: cart.id, t });
    });
}

async function clear({ userId }) {
    return sequelize.transaction(async (t) => {
        const cart = await getOrCreateActiveCart({ userId, t });

        await CartItem.destroy({
            where: { cart_id: cart.id },
            transaction: t,
        });

        return buildCartResponse({ cartId: cart.id, t });
    });
}

module.exports = {
    getMyCart,
    addItem,
    updateItem,
    removeItem,
    clear,
};