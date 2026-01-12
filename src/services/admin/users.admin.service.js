"use strict";

const { sequelize, User, UserRole } = require("../../models");
const { Op } = require("sequelize");
const { AppError } = require("../../utils/errors");

async function createUserWithRoles({ payload }) {
    return sequelize.transaction(async (t) => {
        const phone = String(payload.phone).trim();
        const roles = payload.roles.map((r) => String(r).trim());

        const [user] = await User.findOrCreate({
            where: { phone },
            defaults: {
                phone,
                full_name: payload.full_name || null,
                email: payload.email || null,
                status: "active",
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        // Ensure active
        if (user.status !== "active") {
            await user.update({ status: "active" }, { transaction: t });
        }

        // Update profile fields if passed (safe and additive)
        const nextFullName = payload.full_name || null;
        const nextEmail = payload.email || null;
        const updates = {};
        if (nextFullName && user.full_name !== nextFullName) updates.full_name = nextFullName;
        if (nextEmail && user.email !== nextEmail) updates.email = nextEmail;
        if (Object.keys(updates).length) {
            await user.update(updates, { transaction: t });
        }

        // Insert roles idempotently
        for (const role of roles) {
            await UserRole.findOrCreate({
                where: { user_id: user.id, role },
                defaults: { user_id: user.id, role },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        const userRoles = await UserRole.findAll({
            where: { user_id: user.id },
            attributes: ["role"],
            transaction: t,
        });

        return {
            user: {
                id: user.id,
                phone: user.phone,
                full_name: user.full_name,
                status: user.status,
                roles: userRoles.map((x) => x.role),
            },
        };
    });
}

async function setUserRoles({ userId, roles }) {
    return sequelize.transaction(async (t) => {
        const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "User not found", 404);
        }

        const normalized = roles.map((r) => String(r).trim());

        // Remove existing roles not in new list
        await UserRole.destroy({
            where: {
                user_id: user.id,
                role: { [require("sequelize").Op.notIn]: normalized },
            },
            transaction: t,
        });

        // Add missing roles
        for (const role of normalized) {
            await UserRole.findOrCreate({
                where: { user_id: user.id, role },
                defaults: { user_id: user.id, role },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        const updated = await UserRole.findAll({
            where: { user_id: user.id },
            attributes: ["role"],
            transaction: t,
        });

        return {
            user: {
                id: user.id,
                phone: user.phone,
                full_name: user.full_name,
                status: user.status,
                roles: updated.map((x) => x.role),
            },
        };
    });
}

async function listUsers({ query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;

    const where = {};

    if (query.status) {
        where.status = query.status;
    }

    if (query.q) {
        const q = String(query.q).trim();
        where[Op.or] = [
            { phone: { [Op.iLike]: `%${q}%` } },
            { full_name: { [Op.iLike]: `%${q}%` } },
            { email: { [Op.iLike]: `%${q}%` } },
        ];
    }

    // Role filter is applied via a subquery on user_roles to avoid changing behavior elsewhere
    // and to keep query fast with existing indexes.
    if (query.role) {
        where.id = {
            [Op.in]: sequelize.literal(
                `(SELECT user_id FROM user_roles WHERE role = ${sequelize.escape(String(query.role))})`
            ),
        };
    }

    const sortBy = query.sort_by || "created_at";
    const sortDir = String(query.sort_dir || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { rows, count } = await User.findAndCountAll({
        where,
        include: [
            {
                model: UserRole,
                as: "roles",
                attributes: ["role"],
                required: false,
            },
        ],
        order: [[sortBy, sortDir]],
        limit,
        offset,
        distinct: true,
    });

    const items = rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        full_name: u.full_name,
        email: u.email,
        status: u.status,
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        roles: (u.roles || []).map((r) => r.role),
    }));

    return {
        items,
        page,
        limit,
        total: Number(count || 0),
        total_pages: Math.ceil((Number(count || 0) || 0) / limit),
    };
}

async function getUserById({ userId }) {
    const user = await User.findByPk(userId, {
        include: [
            {
                model: UserRole,
                as: "roles",
                attributes: ["role"],
                required: false,
            },
        ],
    });

    if (!user) {
        throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    return {
        user: {
            id: user.id,
            phone: user.phone,
            full_name: user.full_name,
            email: user.email,
            status: user.status,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
            roles: (user.roles || []).map((r) => r.role),
        },
    };
}

module.exports = {
    listUsers,
    getUserById,
    createUserWithRoles,
    setUserRoles,
};
