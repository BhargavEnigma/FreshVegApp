"use strict";

const { sequelize, Setting } = require("../../models");
const { AppError } = require("../../utils/errors");

async function list() {
    const rows = await Setting.findAll({
        order: [["updated_at", "DESC"]],
    });

    return {
        settings: rows.map((r) => ({
            key: r.key,
            value: r.value,
            updated_at: r.updated_at,
        })),
    };
}

async function getByKey({ key }) {
    const row = await Setting.findByPk(key);
    if (!row) {
        throw new AppError("SETTING_NOT_FOUND", "Setting not found", 404);
    }

    return {
        setting: {
            key: row.key,
            value: row.value,
            updated_at: row.updated_at,
        },
    };
}

async function upsert({ key, value }) {
    return sequelize.transaction(async (t) => {
        const existing = await Setting.findByPk(key, { transaction: t, lock: t.LOCK.UPDATE });

        if (existing) {
            await existing.update({ value }, { transaction: t });
            return {
                setting: {
                    key: existing.key,
                    value: existing.value,
                    updated_at: existing.updated_at,
                },
            };
        }

        const row = await Setting.create({ key, value }, { transaction: t });

        return {
            setting: {
                key: row.key,
                value: row.value,
                updated_at: row.updated_at,
            },
        };
    });
}

module.exports = {
    list,
    getByKey,
    upsert,
};
