"use strict";

const { sequelize, User, UserRole, UserWarehouseAssignment } = require("../../models");
const { Op } = require("sequelize");
const { AppError } = require("../../utils/errors");

function assertWarehouseScopedInternalUser({ roles, warehouseIds }) {
    const normalizedRoles = (roles || []).map((x) => String(x).trim());
    const requiresWarehouse = normalizedRoles.some((role) =>
        ["warehouse_manager", "delivery_partner"].includes(role)
    );

    if (requiresWarehouse && !(warehouseIds || []).length) {
        throw new AppError(
            "WAREHOUSE_REQUIRED",
            "warehouse_ids is required for warehouse_manager and delivery_partner users",
            400
        );
    }
}

async function syncWarehouseAssignments({ userId, warehouseIds = [], transaction }) {
    const normalized = Array.from(new Set((warehouseIds || []).map(String)));

    await UserWarehouseAssignment.destroy({
        where: {
            user_id: userId,
            warehouse_id: { [Op.notIn]: normalized.length ? normalized : [null] },
        },
        transaction,
    });

    for (const warehouseId of normalized) {
        await UserWarehouseAssignment.findOrCreate({
            where: { user_id: userId, warehouse_id: warehouseId },
            defaults: { user_id: userId, warehouse_id: warehouseId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
    }

    if (!normalized.length) {
        await UserWarehouseAssignment.destroy({
            where: { user_id: userId },
            transaction,
        });
    }
}

async function createUserWithRoles({ payload }) {
    return sequelize.transaction(async (t) => {
        const phone = String(payload.phone).trim();
        const roles = payload.roles.map((r) => String(r).trim());

        assertWarehouseScopedInternalUser({
            roles,
            warehouseIds: payload.warehouse_ids || [],
        });

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

        if (user.status !== "active") {
            await user.update({ status: "active" }, { transaction: t });
        }

        const updates = {};
        if (payload.full_name && user.full_name !== payload.full_name) updates.full_name = payload.full_name;
        if (payload.email && user.email !== payload.email) updates.email = payload.email;
        if (Object.keys(updates).length) {
            await user.update(updates, { transaction: t });
        }

        for (const role of roles) {
            await UserRole.findOrCreate({
                where: { user_id: user.id, role },
                defaults: { user_id: user.id, role },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        await syncWarehouseAssignments({
            userId: user.id,
            warehouseIds: payload.warehouse_ids || [],
            transaction: t,
        });

        const [userRoles, assignments] = await Promise.all([
            UserRole.findAll({
                where: { user_id: user.id },
                attributes: ["role"],
                transaction: t,
            }),
            UserWarehouseAssignment.findAll({
                where: { user_id: user.id },
                attributes: ["warehouse_id"],
                transaction: t,
            }),
        ]);

        return {
            user: {
                id: user.id,
                phone: user.phone,
                full_name: user.full_name,
                status: user.status,
                roles: userRoles.map((x) => x.role),
                warehouse_ids: assignments.map((x) => x.warehouse_id),
            },
        };
    });
}

async function setUserRoles({ userId, roles, warehouseIds = [] }) {
    return sequelize.transaction(async (t) => {
        const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "User not found", 404);
        }

        const normalized = roles.map((r) => String(r).trim());

        assertWarehouseScopedInternalUser({
            roles: normalized,
            warehouseIds,
        });

        await UserRole.destroy({
            where: {
                user_id: user.id,
                role: { [Op.notIn]: normalized },
            },
            transaction: t,
        });

        for (const role of normalized) {
            await UserRole.findOrCreate({
                where: { user_id: user.id, role },
                defaults: { user_id: user.id, role },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
        }

        await syncWarehouseAssignments({
            userId: user.id,
            warehouseIds,
            transaction: t,
        });

        const [updated, assignments] = await Promise.all([
            UserRole.findAll({
                where: { user_id: user.id },
                attributes: ["role"],
                transaction: t,
            }),
            UserWarehouseAssignment.findAll({
                where: { user_id: user.id },
                attributes: ["warehouse_id"],
                transaction: t,
            }),
        ]);

        return {
            user: {
                id: user.id,
                phone: user.phone,
                full_name: user.full_name,
                status: user.status,
                roles: updated.map((x) => x.role),
                warehouse_ids: assignments.map((x) => x.warehouse_id),
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
            {
                model: UserWarehouseAssignment,
                as: "warehouse_assignments",
                attributes: ["warehouse_id"],
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
        warehouse_ids: (u.warehouse_assignments || []).map((x) => x.warehouse_id),
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
            {
                model: UserWarehouseAssignment,
                as: "warehouse_assignments",
                attributes: ["warehouse_id"],
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
            warehouse_ids: (user.warehouse_assignments || []).map((x) => x.warehouse_id),
        },
    };
}

module.exports = {
    listUsers,
    getUserById,
    createUserWithRoles,
    setUserRoles,
};