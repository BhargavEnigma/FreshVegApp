"use strict";

const { Inventory, Order, OrderItem, ProductPack, Warehouse, sequelize } = require("../models");
const { AppError } = require("../utils/errors");

function normalizeGroupedItems(items = []) {
    const map = new Map();

    for (const item of items) {
        const key = String(item.product_pack_id);
        const qty = Number(item.quantity || 0);

        if (!key || !Number.isInteger(qty) || qty <= 0) {
            throw new AppError("INVALID_INVENTORY_ITEM", "Invalid inventory item payload", 400);
        }

        map.set(key, (map.get(key) || 0) + qty);
    }

    return Array.from(map.entries()).map(([product_pack_id, quantity]) => ({
        product_pack_id,
        quantity,
    }));
}

async function getInventoryRowForUpdate({ warehouseId, productPackId, t }) {
    const row = await Inventory.findOne({
        where: {
            warehouse_id: warehouseId,
            product_pack_id: productPackId,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    if (!row) {
        throw new AppError(
            "INVENTORY_NOT_FOUND",
            "Inventory is not configured for one or more items",
            400
        );
    }

    return row;
}

async function reserveInventoryForItems({ warehouseId, items, t }) {
    const groupedItems = normalizeGroupedItems(items);

    for (const item of groupedItems) {
        const row = await getInventoryRowForUpdate({
            warehouseId,
            productPackId: item.product_pack_id,
            t,
        });

        const availableQty = Number(row.available_qty || 0);
        const reservedQty = Number(row.reserved_qty || 0);
        const freeQty = availableQty - reservedQty;

        if (freeQty < item.quantity) {
            throw new AppError(
                "INSUFFICIENT_STOCK",
                "Insufficient inventory for one or more items",
                400
            );
        }

        await row.update(
            {
                reserved_qty: reservedQty + item.quantity,
            },
            { transaction: t }
        );
    }

    return { reserved: true };
}

async function releaseReservedInventoryForOrder({ orderId, t }) {
    const order = await Order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const items = await OrderItem.findAll({
        where: { order_id: order.id },
        attributes: ["product_pack_id", "quantity"],
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    const groupedItems = normalizeGroupedItems(
        items.map((item) => ({
            product_pack_id: item.product_pack_id,
            quantity: Number(item.quantity || 0),
        }))
    );

    for (const item of groupedItems) {
        const row = await getInventoryRowForUpdate({
            warehouseId: order.warehouse_id,
            productPackId: item.product_pack_id,
            t,
        });

        const reservedQty = Number(row.reserved_qty || 0);

        await row.update(
            {
                reserved_qty: Math.max(0, reservedQty - item.quantity),
            },
            { transaction: t }
        );
    }

    return { released: true };
}

async function consumeReservedInventoryForOrder({ orderId, t }) {
    const order = await Order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const items = await OrderItem.findAll({
        where: { order_id: order.id },
        attributes: ["product_pack_id", "quantity"],
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    const groupedItems = normalizeGroupedItems(
        items.map((item) => ({
            product_pack_id: item.product_pack_id,
            quantity: Number(item.quantity || 0),
        }))
    );

    for (const item of groupedItems) {
        const row = await getInventoryRowForUpdate({
            warehouseId: order.warehouse_id,
            productPackId: item.product_pack_id,
            t,
        });

        const availableQty = Number(row.available_qty || 0);
        const reservedQty = Number(row.reserved_qty || 0);

        if (reservedQty < item.quantity) {
            throw new AppError(
                "INVENTORY_STATE_INVALID",
                "Reserved inventory is lower than order quantity",
                409
            );
        }

        if (availableQty < item.quantity) {
            throw new AppError(
                "INVENTORY_STATE_INVALID",
                "Available inventory is lower than order quantity",
                409
            );
        }

        await row.update(
            {
                available_qty: availableQty - item.quantity,
                reserved_qty: reservedQty - item.quantity,
            },
            { transaction: t }
        );
    }

    return { consumed: true };
}

async function bootstrapInventoryForExistingPacks() {
    return sequelize.transaction(async (t) => {
        const warehouse = await Warehouse.findOne({
            where: { is_active: true },
            order: [["created_at", "ASC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!warehouse) {
            throw new Error("No active warehouse found");
        }

        const packs = await ProductPack.findAll({
            where: { is_active: true },
            attributes: ["id"],
            transaction: t,
        });

        if (!packs.length) {
            return {
                warehouse_id: warehouse.id,
                created_count: 0,
                skipped_count: 0,
                message: "No active product packs found",
            };
        }

        const packIds = packs.map((pack) => pack.id);

        const existingInventories = await Inventory.findAll({
            where: {
                warehouse_id: warehouse.id,
                product_pack_id: packIds,
            },
            attributes: ["product_pack_id"],
            transaction: t,
        });

        const existingPackIdSet = new Set(
            existingInventories.map((row) => String(row.product_pack_id))
        );

        const rowsToInsert = packIds
            .filter((packId) => !existingPackIdSet.has(String(packId)))
            .map((packId) => ({
                warehouse_id: warehouse.id,
                product_pack_id: packId,
                available_qty: 500,
                reserved_qty: 0,
            }));

        if (rowsToInsert.length) {
            await Inventory.bulkCreate(rowsToInsert, {
                transaction: t,
            });
        }

        return {
            warehouse_id: warehouse.id,
            created_count: rowsToInsert.length,
            skipped_count: packIds.length - rowsToInsert.length,
            total_active_packs: packIds.length,
        };
    });
}

module.exports = {
    reserveInventoryForItems,
    releaseReservedInventoryForOrder,
    consumeReservedInventoryForOrder,
    bootstrapInventoryForExistingPacks
};