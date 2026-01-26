"use strict";

const { Op } = require("sequelize");
const { Banner } = require("../models");

function now() {
    return new Date();
}

async function listActive({ placement = "home" }) {
    const n = now();

    const rows = await Banner.findAll({
        where: {
            placement,
            is_active: true,
            [Op.and]: [
                { [Op.or]: [{ start_at: null }, { start_at: { [Op.lte]: n } }] },
                { [Op.or]: [{ end_at: null }, { end_at: { [Op.gte]: n } }] },
            ],
        },
        order: [["sort_order", "ASC"], ["created_at", "DESC"]],
    });

    return {
        placement,
        count: rows.length,
        banners: rows.map((b) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            image_url: b.image_url,
            action_type: b.action_type,
            action_value: b.action_value,
            sort_order: b.sort_order,
        })),
    };
}

module.exports = {
    listActive,
};
