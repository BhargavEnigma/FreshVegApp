"use strict";

const admin = require("firebase-admin");

let firebaseApp = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    // Option A (recommended on Render): store full JSON in env
    // FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!json) {
        throw new Error("Missing required env var: FIREBASE_SERVICE_ACCOUNT_JSON");
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(json);
    } catch (e) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }

    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    return firebaseApp;
}

function getMessaging() {
    getFirebaseApp();
    return admin.messaging();
}

module.exports = { getMessaging };
