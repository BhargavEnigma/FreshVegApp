"use strict";

const { AppError } = require("../utils/errors");
const { UserRole } = require("../models");

function requireRole(allowedRoles = []) {
    return async function (req, res, next) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                throw new AppError("UNAUTHORIZED", "Missing auth context", 401);
            }

            if (!allowedRoles || allowedRoles.length === 0) {
                return next();
            }

            const rolesRows = await UserRole.findAll({
                where: { user_id: userId },
                attributes: ["role"],
            });

            const roles = rolesRows.map((r) => r.role);

            const ok = roles.some((r) => allowedRoles.includes(r));
            if (!ok) {
                throw new AppError("FORBIDDEN", "Insufficient permissions", 403);
            }

            // optional: attach for later use
            req.user.roles = roles;

            return next();
        } catch (e) {
            return next(e);
        }
    };
}

module.exports = {
    requireRole,
};