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

module.exports = { sendPushToToken };
