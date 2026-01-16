const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const crypto = require("node:crypto");

function createAccessToken({ userId, phone }) {
    return jwt.sign({ userId, phone }, env.jwt.accessSecret, {
        expiresIn: env.jwt.accessExpiresIn
    });
}

function createRefreshToken({ userId, phone }) {
    const payload = { userId };
    if (phone) {
        payload.phone = phone;
    }

    return jwt.sign(payload, env.jwt.refreshSecret, {
        expiresIn: `${env.jwt.refreshExpiresInDays}d`,
    });
}

function verifyAccessToken(token) {
    return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, env.jwt.refreshSecret);
}

function refreshExpiryDate() {
    const ms = env.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
}

/**
 * Store only hash in DB.
 * Use a stable, server-side salt (here we use JWT_REFRESH_SECRET as salt).
 */
function hashRefreshToken(refreshToken) {
    return crypto
        .createHmac("sha256", env.jwt.refreshSecret)
        .update(refreshToken)
        .digest("hex");
}

module.exports = {
    createAccessToken,
    createRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    refreshExpiryDate,
    hashRefreshToken
};
