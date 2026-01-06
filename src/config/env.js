const dotenv = require("dotenv");

dotenv.config();

function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}

function parseBool(value, fallback = false) {
    if (value === undefined) return fallback;
    return String(value).toLowerCase() === "true";
}

function parseIntSafe(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseIntSafe(process.env.PORT, 3000),

    corsOrigins: (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

    db: {
        host: requireEnv("DB_HOST"),
        port: parseIntSafe(requireEnv("DB_PORT"), 5432),
        name: requireEnv("DB_NAME"),
        user: requireEnv("DB_USER"),
        password: requireEnv("DB_PASSWORD"),
        ssl: parseBool(process.env.DB_SSL, false)
    },

    jwt: {
        accessSecret: requireEnv("JWT_ACCESS_SECRET"),
        refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
        refreshExpiresInDays: parseIntSafe(process.env.JWT_REFRESH_EXPIRES_IN_DAYS, 30)
    },

    otp: {
        msg91AuthKey: requireEnv("MSG91_AUTH_KEY"),
        msg91TemplateId: requireEnv("MSG91_TEMPLATE_ID"),
        msg91OTPexpiryMinutes: parseIntSafe(process.env.OTP_EXPIRY_MINUTES, 5),
        msg91RealTimeRes: parseIntSafe(process.env.MSG91_REALTIME_RESPONSE, 1),
        otpLength: parseIntSafe(process.env.OTP_LENGTH, 4),

        // these should NOT be required in production
        bypassEnabled: parseBool(process.env.OTP_BYPASS_ENABLED, false),
        bypassCode: String(process.env.OTP_BYPASS_CODE || "1234").trim(),
    }
};

module.exports = { env };
