"use strict";

const {
    sequelize,
    UserAddress,
    Order,
    OrderItem,
    Payment,
    Warehouse,
    OrderStatusEvent,
    Notification,
    Product,
    ProductPack,
    Setting,
} = require("../models");

const { AppError } = require("../utils/errors");
const { computeOrderTotals } = require("./orderTotals.service");
const PaymentsService = require("./payments.service");
const { findServiceableWarehouseForAddress } = require("./warehouseServiceAreas.service");
// const InventoryService = require("./inventory.service");

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

function getIstDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    return {
        year: parts.find((p) => p.type === "year").value,
        month: parts.find((p) => p.type === "month").value,
        day: parts.find((p) => p.type === "day").value,
        hour: Number(parts.find((p) => p.type === "hour").value),
        minute: Number(parts.find((p) => p.type === "minute").value),
    };
}

function getIstYyyyMmDd(date = new Date()) {
    const parts = getIstDateParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
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

async function getCutoffTimeIst({ t }) {
    const row = await Setting.findByPk("cutoff_time_ist", {
        transaction: t,
        lock: t?.LOCK?.UPDATE,
    });

    const hh = Number(row?.value?.hh);
    const mm = Number(row?.value?.mm);

    return {
        hh: Number.isInteger(hh) && hh >= 0 && hh <= 23 ? hh : 23,
        mm: Number.isInteger(mm) && mm >= 0 && mm <= 59 ? mm : 59,
    };
}

async function isBeforeDailyCutoffIst({ t, date = new Date() }) {
    const { hour, minute } = getIstDateParts(date);
    const cutoff = await getCutoffTimeIst({ t });

    if (hour < cutoff.hh) return true;
    if (hour > cutoff.hh) return false;
    return minute <= cutoff.mm;
}

function normalizePaymentMethod(input) {
    const v = String(input || "").trim().toLowerCase();
    if (v === "upi") return "online";
    if (v === "cod" || v === "online") return v;
    return null;
}

// server cart-based checkout
// async function checkout({ userId, payload }) {
//     return sequelize.transaction(async (t) => {
//         // ✅ New rule: always next-day delivery (IST)
//         const todayIst = getIstYyyyMmDd();
//         const deliveryDate = addDays(todayIst, 1);

//         const cart = await Cart.findOne({
//             where: { user_id: userId, status: "active" },
//             transaction: t,
//             lock: t.LOCK.UPDATE,
//         });

//         if (!cart) {
//             throw new AppError("CART_EMPTY", "Cart is empty", 400);
//         }

//         const items = await CartItem.findAll({
//             where: { cart_id: cart.id },
//             include: [
//                 { model: Product, as: "product", required: false },
//                 { model: ProductPack, as: "pack", required: false },
//             ],
//             transaction: t,
//             // lock: t.LOCK.UPDATE,
//         });

//         if (!items || items.length === 0) {
//             throw new AppError("CART_EMPTY", "Cart is empty", 400);
//         }

//         const address = await UserAddress.findOne({
//             where: { id: payload.address_id, user_id: userId },
//             transaction: t,
//             lock: t.LOCK.UPDATE,
//         });

//         if (!address) {
//             throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
//         }

//         const warehouseId = await getDefaultWarehouseId({ t });

//         let subtotal_paise = 0;

//         for (const it of items) {
//             const p = it.product;
//             const pack = it.pack;

//             if (!p || !p.is_active) {
//                 throw new AppError("PRODUCT_INACTIVE", "A product in your cart is not available", 400);
//             }
//             if (p.is_out_of_stock) {
//                 throw new AppError("OUT_OF_STOCK", "A product in your cart is out of stock", 400);
//             }
//             if (!pack || !pack.is_active) {
//                 throw new AppError("PACK_NOT_FOUND", "A product pack in your cart is not available", 400);
//             }

//             const qty = Number(it.quantity);
//             const unitPrice = Number(it.price_paise);
//             const lineTotal = Math.round(qty * unitPrice);

//             subtotal_paise += lineTotal;
//         }

//         const delivery_fee_paise = 0;
//         const discount_paise = 0;
//         const total_paise = subtotal_paise + delivery_fee_paise - discount_paise;

//         // ✅ Status: UPI -> payment_pending, COD -> placed
//         const isCod = payload.payment_method === "cod";
//         const initialStatus = isCod ? "placed" : "payment_pending";
//         const initialPaymentStatus = isCod ? "paid" : "pending";

//         const order = await Order.create(
//             {
//                 order_number: generateOrderNumber(),
//                 user_id: userId,
//                 warehouse_id: warehouseId,
//                 address_id: address.id,

//                 delivery_date: deliveryDate,
//                 delivery_slot_id: null, // anytime next day

//                 status: initialStatus,
//                 payment_method: payload.payment_method,
//                 payment_status: initialPaymentStatus,

//                 subtotal_paise,
//                 delivery_fee_paise,
//                 discount_paise,
//                 total_paise,
//                 is_locked: false,
//             },
//             { transaction: t }
//         );

//         await OrderItem.bulkCreate(
//             items.map((it) => {
//                 const qty = Number(it.quantity);
//                 const unitPrice = Number(it.price_paise);
//                 const lineTotal = Math.round(qty * unitPrice);

//                 return {
//                     order_id: order.id,
//                     product_id: it.product_id,
//                     product_pack_id: it.product_pack_id || it.pack?.id || null,
//                     pack_label: it.pack?.label ?? null,

//                     product_name: it.product?.name,
//                     unit: it.product?.unit ?? it.pack?.base_unit ?? "unit",

//                     quantity: it.quantity,
//                     unit_price_paise: unitPrice,
//                     line_total_paise: lineTotal,
//                 };
//             }),
//             { transaction: t }
//         );

//         await OrderStatusEvent.create(
//             {
//                 order_id: order.id,
//                 from_status: null,
//                 to_status: initialStatus,
//                 actor_user_id: userId,
//                 note: null,
//                 meta: { payment_method: payload.payment_method },
//             },
//             { transaction: t }
//         );

//         await cart.update({ status: "checked_out" }, { transaction: t });

//         const payment = await Payment.create(
//             {
//                 order_id: order.id,
//                 amount_paise: total_paise,
//                 method: payload.payment_method,
//                 status: isCod ? "paid" : "pending",
//             },
//             { transaction: t }
//         );

//         await Notification.create(
//             {
//                 user_id: userId,
//                 channel: "push",
//                 template: "order_placed",
//                 payload: {
//                     order_id: order.id,
//                     total_paise,
//                     delivery_date: order.delivery_date,
//                 },
//                 status: "queued",
//                 attempt_count: 0,
//                 scheduled_at: null,
//             },
//             { transaction: t }
//         );

//         return {
//             order: {
//                 id: order.id,
//                 status: order.status,
//                 payment_status: order.payment_status,
//                 total_paise,
//                 warehouse_id: order.warehouse_id,
//                 delivery_date: order.delivery_date,
//             },
//             payment: {
//                 id: payment.id,
//                 status: payment.status,
//                 method: payment.method,
//             },
//         };
//     });
// }


// local cart based from mobile checkout

async function checkout({ userId, payload, idempotencyKey = null }) {
    return sequelize.transaction(async (t) => {
        const paymentMethod = normalizePaymentMethod(payload?.payment_method);
        if (!paymentMethod) {
            throw new AppError("INVALID_PAYMENT_METHOD", "payment_method must be 'cod' or 'online'", 400);
        }

        if (!Array.isArray(payload?.items) || payload.items.length <= 0) {
            throw new AppError("INVALID_ITEMS", "items must be a non-empty array", 400);
        }

        const beforeCutoff = await isBeforeDailyCutoffIst({ t });
        if (!beforeCutoff) {
            throw new AppError(
                "ORDER_CUTOFF_PASSED",
                "Today cutoff has passed. Please place this order for the next delivery cycle from the app.",
                400
            );
        }

        if (idempotencyKey) {
            const existingOrder = await Order.findOne({
                where: { user_id: userId, idempotency_key: String(idempotencyKey) },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (existingOrder) {
                if (existingOrder.payment_method === "online") {
                    const onlinePayment = await PaymentsService.createOrReuseGatewayOrderForCurrentOrder({
                        order: existingOrder,
                        t,
                    });

                    return {
                        ...onlinePayment,
                        amounts: {
                            total_paise: existingOrder.total_paise,
                            subtotal_paise: existingOrder.subtotal_paise,
                            delivery_fee_paise: existingOrder.delivery_fee_paise,
                            gst_rate_bps: existingOrder.gst_rate_bps,
                            gst_amount_paise: existingOrder.gst_amount_paise,
                            grand_total_paise: existingOrder.grand_total_paise,
                        },
                        warehouse_id: existingOrder.warehouse_id,
                        delivery_date: existingOrder.delivery_date,
                        idempotent: true,
                    };
                }

                const existingPayment = await Payment.findOne({
                    where: { order_id: existingOrder.id },
                    order: [["created_at", "DESC"]],
                    transaction: t,
                });

                return {
                    order_id: existingOrder.id,
                    order_status: existingOrder.status,
                    payment_status: existingOrder.payment_status,
                    retry_allowed: !!existingOrder.retry_allowed,
                    refund_status: existingOrder.refund_status || "none",
                    payment_attempt_id: existingOrder.current_payment_attempt_id || null,
                    amounts: {
                        total_paise: existingOrder.total_paise,
                        subtotal_paise: existingOrder.subtotal_paise,
                        delivery_fee_paise: existingOrder.delivery_fee_paise,
                        gst_rate_bps: existingOrder.gst_rate_bps,
                        gst_amount_paise: existingOrder.gst_amount_paise,
                        grand_total_paise: existingOrder.grand_total_paise,
                    },
                    warehouse_id: existingOrder.warehouse_id,
                    delivery_date: existingOrder.delivery_date,
                    payment: existingPayment
                        ? {
                            id: existingPayment.id,
                            status: existingPayment.status,
                            method: existingPayment.method,
                            provider: existingPayment.provider || null,
                            provider_payment_id: existingPayment.provider_payment_id || null,
                        }
                        : { id: null, status: null, method: existingOrder.payment_method || null },
                    idempotent: true,
                };
            }
        }

        const todayIst = getIstYyyyMmDd();
        const deliveryDate = addDays(todayIst, 1);

        const address = await UserAddress.findOne({
            where: { id: payload.address_id, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!address) {
            throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
        }

        const serviceability = await findServiceableWarehouseForAddress({
            address,
            t,
        });

        if (!serviceability) {
            throw new AppError(
                "AREA_NOT_SERVICEABLE",
                "Sorry, delivery is not available at this address yet.",
                400
            );
        }

        const warehouseId = serviceability.warehouse.id;

        const groupedItemsMap = new Map();

        for (const item of payload.items) {
            const key = `${item.product_id}:${item.product_pack_id}`;
            const existing = groupedItemsMap.get(key);

            if (existing) {
                existing.quantity += Number(item.quantity);
            } else {
                groupedItemsMap.set(key, {
                    product_id: item.product_id,
                    product_pack_id: item.product_pack_id,
                    quantity: Number(item.quantity),
                });
            }
        }

        const groupedItems = Array.from(groupedItemsMap.values());
        // Fetch packs + products for all items
        const packIds = groupedItems.map((i) => i.product_pack_id);

        const packs = await ProductPack.findAll({
            where: { id: packIds, is_active: true },
            include: [{ model: Product, as: "product", required: true, where: { is_active: true } }],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        const packMap = new Map(packs.map((p) => [p.id, p]));
        let subtotal_paise = 0;

        const normalizedItems = groupedItems.map((it) => {
            if (!it?.product_id || !it?.product_pack_id) {
                throw new AppError("INVALID_ITEM", "Each item must include product_id and product_pack_id", 400);
            }

            const pack = packMap.get(it.product_pack_id);

            if (!pack || !pack.is_active) {
                throw new AppError("PACK_NOT_FOUND", "A product pack is not available", 400);
            }

            const product = pack.product;
            if (!product || !product.is_active) {
                throw new AppError("PRODUCT_INACTIVE", "A product is not available", 400);
            }

            if (product.is_out_of_stock) {
                throw new AppError("OUT_OF_STOCK", "A product is out of stock", 400);
            }

            // Ensure pack belongs to product_id sent by client (extra safety)
            if (String(product.id) !== String(it.product_id)) {
                throw new AppError("PACK_PRODUCT_MISMATCH", "Pack does not belong to the product", 400);
            }

            const qty = Number(it.quantity);
            if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
                throw new AppError("INVALID_QUANTITY", "Item quantity must be a positive integer", 400);
            }

            const unitPrice = Number(pack.selling_price_paise);
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                throw new AppError("INVALID_PRICE", "Invalid pack price", 500);
            }

            const lineTotal = Math.round(qty * unitPrice);
            subtotal_paise += lineTotal;

            return {
                qty,
                unitPrice,
                lineTotal,
                product,
                pack,
            };
        });

        const discount_paise = 0;
        const totals = await computeOrderTotals({ subtotal_paise, t });
        const delivery_fee_paise = totals.delivery_fee_paise;
        const gst_rate_bps = totals.gst_rate_bps;
        const gst_amount_paise = totals.gst_amount_paise;
        const grand_total_paise = totals.grand_total_paise;

        // Backward compatibility: keep using total_paise everywhere (mobile already expects it)
        const total_paise = grand_total_paise - discount_paise;

        const isCod = paymentMethod === "cod";
        const initialStatus = isCod ? "placed" : "payment_pending";
        const initialPaymentStatus = "pending";

        const deliverySlotId = null;

        const order = await Order.create(
            {
                order_number: generateOrderNumber(),
                user_id: userId,
                warehouse_id: warehouseId,
                address_id: address.id,

                // frozen delivery snapshot
                delivery_label: address.label ?? null,
                delivery_name: address.name ?? null,
                delivery_phone: address.phone ?? null,
                delivery_address_line1: address.address_line1 ?? null,
                delivery_address_line2: address.address_line2 ?? null,
                delivery_landmark: address.landmark ?? null,
                delivery_area: address.area ?? null,
                delivery_city: address.city ?? null,
                delivery_state: address.state ?? null,
                delivery_pincode: address.pincode ?? null,
                delivery_lat: address.lat ?? null,
                delivery_lng: address.lng ?? null,

                delivery_date: deliveryDate,
                delivery_slot_id: deliverySlotId,
                status: initialStatus,
                payment_method: paymentMethod,
                payment_status: initialPaymentStatus,
                subtotal_paise,
                delivery_fee_paise,
                discount_paise,
                gst_rate_bps,
                gst_amount_paise,
                grand_total_paise,
                total_paise,
                is_locked: false,
                idempotency_key: idempotencyKey ? String(idempotencyKey) : null,
            },
            { transaction: t }
        );

        await OrderItem.bulkCreate(
            normalizedItems.map((x) => ({
                order_id: order.id,
                product_id: x.product.id,
                product_pack_id: x.pack.id,
                pack_label: x.pack.label ?? null,
                product_name: x.product.name,
                unit: x.pack.base_unit ?? x.product.unit ?? "unit",
                quantity: x.qty,
                unit_price_paise: x.unitPrice,
                line_total_paise: x.lineTotal,
            })),
            { transaction: t }
        );

        await OrderStatusEvent.create(
            {
                order_id: order.id,
                from_status: null,
                to_status: initialStatus,
                actor_user_id: userId,
                note: null,
                meta: {
                    payment_method: paymentMethod,
                    source: "local_cart",
                },
            },
            { transaction: t }
        );

        const payment = await Payment.create(
            {
                order_id: order.id,
                amount_paise: total_paise,
                method: paymentMethod,
                status: "pending",
                provider: null,
            },
            { transaction: t }
        );

        if (isCod) {
            await order.update(
                {
                    retry_allowed: false,
                    refund_status: "none",
                    current_payment_attempt_id: null,
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
                order_id: order.id,
                order_status: order.status,
                payment_status: order.payment_status,
                retry_allowed: false,
                refund_status: "none",
                payment_attempt_id: null,
                amounts: {
                    total_paise,
                    subtotal_paise,
                    delivery_fee_paise,
                    gst_rate_bps,
                    gst_amount_paise,
                    grand_total_paise,
                },
                warehouse_id: order.warehouse_id,
                delivery_date: order.delivery_date,
                payment: {
                    id: payment.id,
                    status: payment.status,
                    method: payment.method,
                },
            };
        }

        const onlinePayment = await PaymentsService.createOrReuseGatewayOrderForCurrentOrder({ order, t });

        return {
            ...onlinePayment,
            amounts: {
                total_paise,
                subtotal_paise,
                delivery_fee_paise,
                gst_rate_bps,
                gst_amount_paise,
                grand_total_paise,
            },
            warehouse_id: order.warehouse_id,
            delivery_date: order.delivery_date,
        };
    });
}

module.exports = { checkout };
