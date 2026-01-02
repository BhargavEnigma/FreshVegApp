const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const Response = require("../utils/response.util");
const { verifyAccessToken } = require("../services/token.service");

function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return Response.fail(res, 401, "UNAUTHORIZED", "Missing access token");
    }

    try {
        
        const decoded = verifyAccessToken(token);
        req.user = {
            userId: decoded.userId,
            phone: decoded.phone,
        };

        return next();
        
    } catch (err) {
        return Response.fail(res, 401, "UNAUTHORIZED", "Invalid or expired access token");
    }
}

module.exports = { requireAuth };
