const { app } = require("./app");
const { env } = require("./config/env");
const { testDbConnection } = require("./config/db");
require("./models");

const { startScheduler } = require("./jobs/scheduler");
const { startNotificationsWorker } = require("./jobs/notifications.worker");

async function start() {
    await testDbConnection();
    console.log("Database connected");

    if (process.env.ENABLE_SCHEDULER === "true") {
        startScheduler();
    } else {
        console.log("[scheduler] disabled");
    }

    if (process.env.ENABLE_NOTIFICATIONS_WORKER === "true") {
        startNotificationsWorker();
    } else {
        console.log("[notifications.worker] disabled");
    }

    app.listen(env.port, "0.0.0.0", () => {
        console.log(`Server running on port ${env.port}`);
    });
}

start().catch((err) => {
    console.error({ err }, "Failed to start server");
    process.exit(1);
});