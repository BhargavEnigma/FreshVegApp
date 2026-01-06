"use strict";

const { DeliverySlot } = require("../models");

async function list({ query }) {
    const where = {};

    if (!query.include_inactive) {
        where.is_active = true;
    }

    // NOTE (Blueprint v1.2): In future you can apply date-based rules (cutoff, disabled slots)
    // using settings table. For now, date is accepted but not used to filter.
    // Keep date so frontend can pass it consistently.
    const slots = await DeliverySlot.findAll({
        where,
        order: [["start_time", "ASC"]],
    });

    return {
        delivery_slots: slots.map((s) => ({
            id: s.id,
            name: s.name,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: !!s.is_active,
        })),
    };
}

module.exports = {
    list,
};
