"use strict";

const { sequelize, User, UserRole } = require("../../models");
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
                status: "active",
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        // Ensure active
        if (user.status !== "active") {
            await user.update({ status: "active" }, { transaction: t });
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

module.exports = {
    createUserWithRoles,
    setUserRoles,
};
