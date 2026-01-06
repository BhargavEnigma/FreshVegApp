"use strict";

const { AppError } = require("../utils/errors");
const { sequelize, UserAddress, Setting } = require("../models");

async function getDefaultLocationFromSettings({ t }) {
    // settings table (Blueprint v1.2)
    // keys: service_city, service_state (or service_city has {name:"Ahmedabad"})
    const [citySetting, stateSetting] = await Promise.all([
        Setting.findByPk("service_city", { transaction: t }),
        Setting.findByPk("service_state", { transaction: t }),
    ]);

    const city =
        citySetting?.value?.name ||
        citySetting?.value?.city ||
        citySetting?.value ||
        null;

    const state =
        stateSetting?.value?.name ||
        stateSetting?.value?.state ||
        stateSetting?.value ||
        null;

    return {
        city: typeof city === "string" ? city : null,
        state: typeof state === "string" ? state : null,
    };
}

async function list({ userId }) {
    const rows = await UserAddress.findAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]],
    });

    return {
        addresses: rows.map((a) => ({
            id: a.id,
            label: a.label ?? null,
            name: a.name ?? null,
            phone: a.phone ?? null,
            address_line1: a.address_line1,
            address_line2: a.address_line2 ?? null,
            landmark: a.landmark ?? null,
            area: a.area ?? null,
            city: a.city ?? null,
            state: a.state ?? null,
            pincode: a.pincode,
            lat: a.lat ?? null,
            lng: a.lng ?? null,
            is_default: !!a.is_default,
            created_at: a.created_at,
            updated_at: a.updated_at,
        })),
    };
}

async function create({ userId, payload }) {
    return sequelize.transaction(async (t) => {
        const existingCount = await UserAddress.count({
            where: { user_id: userId },
            transaction: t,
        });

        const shouldBeDefault = payload.is_default === true || existingCount === 0;

        // ✅ Blueprint v1.2: default city/state should come from settings if not provided
        const defaults = await getDefaultLocationFromSettings({ t });

        const finalCity = payload.city ?? defaults.city;
        const finalState = payload.state ?? defaults.state;

        if (!finalCity || !finalState) {
            // If you want to enforce service area strictly, keep this error.
            // Otherwise remove this check.
            throw new AppError(
                "SERVICE_LOCATION_NOT_CONFIGURED",
                "Service city/state is not configured",
                500
            );
        }

        if (shouldBeDefault) {
            // Concurrency-safe: lock rows then unset
            await UserAddress.findAll({
                where: { user_id: userId, is_default: true },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            await UserAddress.update(
                { is_default: false },
                { where: { user_id: userId }, transaction: t }
            );
        }

        const row = await UserAddress.create(
            {
                user_id: userId,
                label: payload.label ?? null,
                name: payload.name ?? null,
                phone: payload.phone ?? null,
                address_line1: payload.address_line1,
                address_line2: payload.address_line2 ?? null,
                landmark: payload.landmark ?? null,
                area: payload.area ?? null,
                city: finalCity,
                state: finalState,
                pincode: payload.pincode,
                lat: payload.lat ?? null,
                lng: payload.lng ?? null,
                is_default: shouldBeDefault,
            },
            { transaction: t }
        );

        return {
            address: {
                id: row.id,
                is_default: !!row.is_default,
            },
        };
    });
}

async function update({ userId, addressId, payload }) {
    return sequelize.transaction(async (t) => {
        const row = await UserAddress.findOne({
            where: { id: addressId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!row) {
            throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
        }

        const wantsDefault = payload.is_default === true;

        // If user sets is_default=true, enforce single-default
        if (wantsDefault) {
            await UserAddress.findAll({
                where: { user_id: userId, is_default: true },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            await UserAddress.update(
                { is_default: false },
                { where: { user_id: userId }, transaction: t }
            );
        }

        // If city/state not provided but currently null, apply settings defaults
        let city = payload.city ?? row.city;
        let state = payload.state ?? row.state;

        if (!city || !state) {
            const defaults = await getDefaultLocationFromSettings({ t });
            city = city ?? defaults.city;
            state = state ?? defaults.state;
        }

        await row.update(
            {
                label: payload.label ?? row.label,
                name: payload.name ?? row.name,
                phone: payload.phone ?? row.phone,
                address_line1: payload.address_line1 ?? row.address_line1,
                address_line2: payload.address_line2 ?? row.address_line2,
                landmark: payload.landmark ?? row.landmark,
                area: payload.area ?? row.area,
                city,
                state,
                pincode: payload.pincode ?? row.pincode,
                lat: payload.lat ?? row.lat,
                lng: payload.lng ?? row.lng,
                is_default: wantsDefault ? true : row.is_default,
            },
            { transaction: t }
        );

        return {
            address: {
                id: row.id,
                is_default: !!row.is_default,
                updated_at: row.updated_at,
            },
        };
    });
}

async function remove({ userId, addressId }) {
    return sequelize.transaction(async (t) => {
        const row = await UserAddress.findOne({
            where: { id: addressId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!row) {
            throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
        }

        const wasDefault = !!row.is_default;

        await row.destroy({ transaction: t });

        if (wasDefault) {
            const latest = await UserAddress.findOne({
                where: { user_id: userId },
                order: [["created_at", "DESC"]],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (latest) {
                await latest.update({ is_default: true }, { transaction: t });
            }
        }

        return { deleted: true };
    });
}

async function setDefault({ userId, addressId }) {
    return sequelize.transaction(async (t) => {
        const row = await UserAddress.findOne({
            where: { id: addressId, user_id: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!row) {
            throw new AppError("ADDRESS_NOT_FOUND", "Address not found", 404);
        }

        await UserAddress.findAll({
            where: { user_id: userId, is_default: true },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        await UserAddress.update(
            { is_default: false },
            { where: { user_id: userId }, transaction: t }
        );

        await row.update({ is_default: true }, { transaction: t });

        return {
            address: {
                id: row.id,
                is_default: true,
            },
        };
    });
}

module.exports = {
    list,
    create,
    update,
    remove,
    setDefault,
};
