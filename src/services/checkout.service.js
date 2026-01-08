"use strict";

const {
    sequelize,
    Cart,
    CartItem,
    Product,
    ProductPack,
    UserAddress,
    Order,
    OrderItem,
    Payment,
    Warehouse,
    OrderStatusEvent,
    Notification,
} = require("../models");

const { AppError } = require("../utils/errors");

function generateOrderNumber() {
    const now = Date.now().toString().slice(-8);
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    return `FV${now}${rnd}`;
}

async function getDefaultWarehouseId({ t }) {
    const wh = await Warehouse.findOne({
        where: { is_active: true },
        order: [["created_at", "ASC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    if (!wh) {
        throw new AppError("WAREHOUSE_NOT_CONFIGURED", "Warehouse is not configured", 500);
    }

    return wh.id;
}

function getIstYyyyMmDd() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;

    return `${y}-${m}-${d}`;
}

function addDays(yyyyMmDd, days) {
    const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

async function checkout({ userId, payload }) {
    return sequelize.transaction(async (t) => {
        // ✅ New rule: always next-day delivery (IST)
        const todayIst = getIstYyyyMmDd();
        const deliveryDate = addDays(todayIst, 1);

        const cart = await Cart.findOne({
            where: { user_id: userId, status: "active" },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!cart) {
            throw new AppError("CART_EMPTY", "Cart is empty", 400);
        }

        const items = await CartItem.findAll({
            where: { cart_id: cart.id },
            include: [
                { model: Product, as: "product", required: false },
                { model: ProductPack, as: "pack", required: false },
            ],
            transaction: t,
            // lock: t.LOCK.UPDATE,
        });

        if (!items || items.length === 0) {
            throw new AppError("CART_EMPTY", "Cart is empty", 400);
        }

        const address = await UserAddress.findOne({
            where: { id: payload.address_id, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!address) {
            throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
        }

        const warehouseId = await getDefaultWarehouseId({ t });

        let subtotal_paise = 0;

        for (const it of items) {
            const p = it.product;
            const pack = it.pack;

            if (!p || !p.is_active) {
                throw new AppError("PRODUCT_INACTIVE", "A product in your cart is not available", 400);
            }
            if (p.is_out_of_stock) {
                throw new AppError("OUT_OF_STOCK", "A product in your cart is out of stock", 400);
            }
            if (!pack || !pack.is_active) {
                throw new AppError("PACK_NOT_FOUND", "A product pack in your cart is not available", 400);
            }

            const qty = Number(it.quantity);
            const unitPrice = Number(it.price_paise);
            const lineTotal = Math.round(qty * unitPrice);

            subtotal_paise += lineTotal;
        }

        const delivery_fee_paise = 0;
        const discount_paise = 0;
        const total_paise = subtotal_paise + delivery_fee_paise - discount_paise;

        // ✅ Status: UPI -> payment_pending, COD -> placed
        const isCod = payload.payment_method === "cod";
        const initialStatus = isCod ? "placed" : "payment_pending";
        const initialPaymentStatus = isCod ? "paid" : "pending";

        const order = await Order.create(
            {
                order_number: generateOrderNumber(),
                user_id: userId,
                warehouse_id: warehouseId,
                address_id: address.id,

                delivery_date: deliveryDate,
                delivery_slot_id: null, // anytime next day

                status: initialStatus,
                payment_method: payload.payment_method,
                payment_status: initialPaymentStatus,

                subtotal_paise,
                delivery_fee_paise,
                discount_paise,
                total_paise,
                is_locked: false,
            },
            { transaction: t }
        );

        await OrderItem.bulkCreate(
            items.map((it) => {
                const qty = Number(it.quantity);
                const unitPrice = Number(it.price_paise);
                const lineTotal = Math.round(qty * unitPrice);

                return {
                    order_id: order.id,
                    product_id: it.product_id,
                    product_pack_id: it.product_pack_id || it.pack?.id || null,
                    pack_label: it.pack?.label ?? null,

                    product_name: it.product?.name,
                    unit: it.product?.unit ?? it.pack?.base_unit ?? "unit",

                    quantity: it.quantity,
                    unit_price_paise: unitPrice,
                    line_total_paise: lineTotal,
                };
            }),
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: null,
                to_status: initialStatus,
                actor_user_id: userId,
                note: null,
                meta: { payment_method: payload.payment_method },
            },
            { transaction: t }
        );

        await cart.update({ status: "checked_out" }, { transaction: t });

        const payment = await Payment.create(
            {
                order_id: order.id,
                amount_paise: total_paise,
                method: payload.payment_method,
                status: isCod ? "paid" : "pending",
            },
            { transaction: t }
        );

        await Notification.create(
            {
                user_id: userId,
                channel: "push",
                template: "order_placed",
                payload: {
                    order_id: order.id,
                    total_paise,
                    delivery_date: order.delivery_date,
                },
                status: "queued",
                attempt_count: 0,
                scheduled_at: null,
            },
            { transaction: t }
        );

        return {
            order: {
                id: order.id,
                status: order.status,
                payment_status: order.payment_status,
                total_paise,
                warehouse_id: order.warehouse_id,
                delivery_date: order.delivery_date,
            },
            payment: {
                id: payment.id,
                status: payment.status,
                method: payment.method,
            },
        };
    });
}

module.exports = { checkout };