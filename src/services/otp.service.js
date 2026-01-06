const axios = require("axios");
const { env } = require("../config/env");
const { AppError } = require("../utils/errors");

const MSG91_BASE_URL = "https://control.msg91.com/api/v5";

/**
 * MSG91 v5: Send OTP
 * GET /otp?otp_expiry=&template_id=&mobile=&authkey=&realTimeResponse=
 */
async function sendOtpViaMsg91({ phone, otpExpiryMinutes }) {
    if (!env.otp.msg91AuthKey) {
        throw new AppError("CONFIG_ERROR", "MSG91_AUTH_KEY missing", 500);
    }
    if (!env.otp.msg91TemplateId) {
        throw new AppError("CONFIG_ERROR", "MSG91_TEMPLATE_ID missing", 500);
    }

    const params = {
        otp_expiry: String(otpExpiryMinutes ?? env.otp.msg91OTPexpiryMinutes ?? 5),
        template_id: env.otp.msg91TemplateId,
        mobile: phone, // must be like 9198XXXXXXXX
        authkey: env.otp.msg91AuthKey, // also pass in query (as you requested)
        realTimeResponse: String(env.otp.msg91RealTimeRes ?? 1),
        otp_length: String(env.otp.otpLength ?? 4),
    };

    try {
        const resp = await axios.get(`${MSG91_BASE_URL}/otp`, {
            params,
            headers: {
                authkey: env.otp.msg91AuthKey, // send in header too (more compatible)
            },
            timeout: 15000,
        });

        // Typical responses vary, but many return:
        // { type: "success", message: "<request_id>" } or similar.
        const data = resp?.data || {};

        if (data?.type && String(data.type).toLowerCase() !== "success") {
            throw new AppError("PROVIDER_ERROR", data?.message || "MSG91 send OTP failed", 502);
        }

        return {
            provider: "msg91",
            provider_request_id: data?.message || data?.request_id || null,
            expires_in_seconds: Number(params.otp_expiry) * 60,
            raw: data,
        };
    } catch (e) {
        if (e instanceof AppError) throw e;

        const msg =
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            e?.message ||
            "Unable to send OTP";

        throw new AppError("PROVIDER_ERROR", `MSG91 send OTP failed: ${msg}`, 502);
    }
}

/**
 * MSG91 v5: Verify OTP
 * Common v5 usage verifies via:
 * GET /otp/verify?mobile=&otp=&authkey=&otp_expiry=
 * (Many v5 libs follow this contract.) :contentReference[oaicite:3]{index=3}
 */
async function verifyOtpViaMsg91({ phone, otp, otpExpiryMinutes }) {
    if (!env.otp.msg91AuthKey) {
        throw new AppError("CONFIG_ERROR", "MSG91_AUTH_KEY missing", 500);
    }

    const params = {
        mobile: phone,
        otp: otp,
        authkey: env.otp.msg91AuthKey,
    };

    // If you set custom expiry in send OTP, pass same expiry while verifying
    const expiryToUse = otpExpiryMinutes ?? env.otp.msg91OTPexpiryMinutes;
    if (expiryToUse) {
        params.otp_expiry = String(expiryToUse);
    }

    try {
        const resp = await axios.get(`${MSG91_BASE_URL}/otp/verify`, {
            params,
            headers: {
                authkey: env.otp.msg91AuthKey, // header too :contentReference[oaicite:4]{index=4}
            },
            timeout: 15000,
        });

        const data = resp?.data || {};

        // Success detection (MSG91 responses can differ)
        const type = (data?.type || "").toString().toLowerCase();
        const message = (data?.message || "").toString().toLowerCase();

        const isSuccess =
            type === "success" ||
            message.includes("otp_verified") ||
            message.includes("verified") ||
            message.includes("success");

        if (!isSuccess) {
            throw new AppError("INVALID_OTP", data?.message || "Invalid OTP", 400);
        }

        return { verified: true, raw: data };
    } catch (e) {
        if (e instanceof AppError) throw e;

        const status = e?.response?.status;

        // Most OTP failures come back as 4xx with a message body
        const msg =
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            e?.message ||
            "OTP verification failed";

        if (status && status >= 400 && status < 500) {
            throw new AppError("INVALID_OTP", `MSG91 verify failed: ${msg}`, 400);
        }

        throw new AppError("PROVIDER_ERROR", `MSG91 verify error: ${msg}`, 502);
    }
}

module.exports = {
    sendOtpViaMsg91,
    verifyOtpViaMsg91,
};
