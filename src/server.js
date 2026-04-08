const { app } = require("./app");
const { env } = require("./config/env");
const { testDbConnection, syncDatabase } = require("./config/db");
const models = require("./models");
const { startScheduler } = require("./jobs/scheduler");
const { startNotificationsWorker } = require("./jobs/notifications.worker");

async function start() {
    await testDbConnection();
    console.log("Database connected");

    // await syncDatabase({ models });

    startScheduler();
    startNotificationsWorker();

    // ✅ IMPORTANT for Render: bind to 0.0.0.0
    app.listen(env.port, "0.0.0.0", () => {
        console.log(`Server running on port ${env.port}`);
    });
}

start().catch((err) => {
    console.error({ err }, "Failed to start server");
    process.exit(1);
});