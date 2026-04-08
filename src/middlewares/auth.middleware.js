const Response = require("../utils/response.util");
const { verifyAccessToken } = require("../services/token.service");
const { User } = require("../models");

async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return Response.fail(res, 401, "UNAUTHORIZED", "Missing access token");
    }

    try {
        const decoded = verifyAccessToken(token);

        const user = await User.findByPk(decoded.userId, {
            attributes: ["id", "phone", "status"],
        });

        if (!user) {
            return Response.fail(res, 401, "UNAUTHORIZED", "User not found for access token");
        }

        if (user.status !== "active") {
            return Response.fail(res, 403, "USER_BLOCKED", "User account is blocked");
        }

        req.user = {
            userId: user.id,
            phone: user.phone,
            status: user.status,
        };

        next();
    } catch (_err) {
        return Response.fail(res, 401, "UNAUTHORIZED", "Invalid or expired access token");
    }
}

module.exports = { requireAuth };