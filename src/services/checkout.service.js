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

function parseYyyyMmDd(dateStr) {
    if (!dateStr) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    return dateStr;
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

function getIstHourMinute() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());

    const hh = Number(parts.find((p) => p.type === "hour").value);
    const mm = Number(parts.find((p) => p.type === "minute").value);
    return { hh, mm };
}

function addDays(yyyyMmDd, days) {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

async function ensureDeliveryDateValid({ delivery_date }) {
    if (!delivery_date) return;

    const d = parseYyyyMmDd(delivery_date);
    if (!d) {
        throw new AppError("INVALID_DELIVERY_DATE", "Invalid delivery_date format", 400);
    }

    const todayIst = getIstYyyyMmDd();
    if (d < todayIst) {
        throw new AppError("INVALID_DELIVERY_DATE", "delivery_date cannot be in the past", 400);
    }

    // ✅ Blueprint cutoff: orders must be placed by 11:59 PM IST for next-morning delivery
    // If user requests "tomorrow" after cutoff (i.e. after 23:59), block.
    const { hh, mm } = getIstHourMinute();
    const afterCutoff = hh === 0 ? false : (hh > 23 || (hh === 23 && mm >= 59)); // practical guard

    const tomorrowIst = addDays(todayIst, 1);
    if (afterCutoff && d === tomorrowIst) {
        throw new AppError(
            "ORDER_CUTOFF_PASSED",
            "Cutoff passed for next-day delivery. Please choose a later delivery date.",
            409
        );
    }
}

async function checkout({ userId, payload }) {
    return sequelize.transaction(async (t) => {
        await ensureDeliveryDateValid({ delivery_date: payload.delivery_date ?? null });

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
            lock: t.LOCK.UPDATE,
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
                delivery_date: payload.delivery_date,
                delivery_slot_id: payload.delivery_slot_id ?? null,

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

        // ✅ COD payment must be "paid" immediately
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
