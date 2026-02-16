"use strict";

const { getMessaging } = require("../config/firebase");

async function sendPushToToken({ token, title, body, data }) {
    if (!token) {
        return { ok: false, error: "MISSING_TOKEN" };
    }

    const message = {
        token,
        notification: { title, body },
        data: data || {},
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
    };

    const res = await getMessaging().send(message);
    return { ok: true, message_id: res };
}

async function sendPushToTokens({ tokens, title, body, data }) {
    const list = (tokens || []).map((t) => String(t || "").trim()).filter(Boolean);
    if (!list.length) {
        return { ok: false, error: "MISSING_TOKENS" };
    }

    const message = {
        tokens: list,
        notification: { title, body },
        data: data || {},
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
    };

    // sendEachForMulticast returns per-token responses (needed to detect invalid tokens)
    const res = await getMessaging().sendEachForMulticast(message);
    return {
        ok: true,
        success_count: res.successCount,
        failure_count: res.failureCount,
        responses: res.responses,
    };
}

module.exports = { sendPushToToken, sendPushToTokens };
