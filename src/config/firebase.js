"use strict";

const admin = require("firebase-admin");

let firebaseApp = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) return null;

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(json);
    } catch (e) {
        return null;
    }

    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    return firebaseApp;
}

function getMessaging() {
    const app = getFirebaseApp();
    if (!app) return null;
    return admin.messaging();
}

module.exports = { getMessaging };