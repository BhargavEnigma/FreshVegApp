"use strict";

const { sequelize, DeliverySlot } = require("../../models");
const { AppError } = require("../../utils/errors");

function timeToMinutes(t) {
    const v = String(t);
    const parts = v.split(":");
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
        return NaN;
    }
    return hh * 60 + mm;
}

async function list() {
    const slots = await DeliverySlot.findAll({
        order: [["start_time", "ASC"]],
    });

    return { delivery_slots: slots };
}

async function create({ payload }) {
    return sequelize.transaction(async (t) => {
        const startM = timeToMinutes(payload.start_time);
        const endM = timeToMinutes(payload.end_time);

        if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
            throw new AppError("INVALID_SLOT_TIME", "end_time must be after start_time", 400);
        }

        const slot = await DeliverySlot.create(
            {
                name: payload.name,
                start_time: payload.start_time,
                end_time: payload.end_time,
                is_active: payload.is_active ?? true,
            },
            { transaction: t }
        );

        return { delivery_slot: slot };
    });
}

async function update({ slotId, payload }) {
    return sequelize.transaction(async (t) => {
        const slot = await DeliverySlot.findByPk(slotId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!slot) {
            throw new AppError("DELIVERY_SLOT_NOT_FOUND", "Delivery slot not found", 404);
        }

        const start = payload.start_time ?? slot.start_time;
        const end = payload.end_time ?? slot.end_time;

        const startM = timeToMinutes(start);
        const endM = timeToMinutes(end);

        if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
            throw new AppError("INVALID_SLOT_TIME", "end_time must be after start_time", 400);
        }

        await slot.update(
            {
                name: payload.name ?? slot.name,
                start_time: start,
                end_time: end,
            },
            { transaction: t }
        );

        return { delivery_slot: slot };
    });
}

async function setActive({ slotId, is_active }) {
    return sequelize.transaction(async (t) => {
        const slot = await DeliverySlot.findByPk(slotId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!slot) {
            throw new AppError("DELIVERY_SLOT_NOT_FOUND", "Delivery slot not found", 404);
        }

        await slot.update({ is_active: !!is_active }, { transaction: t });

        return { delivery_slot: { id: slot.id, is_active: slot.is_active } };
    });
}

module.exports = {
    list,
    create,
    update,
    setActive,
};
