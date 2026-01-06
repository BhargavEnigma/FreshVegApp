const { app } = require("./app");
const { env } = require("./config/env");
const { testDbConnection } = require("./config/db");
const { startScheduler } = require("./jobs/scheduler");

async function start() {
    await testDbConnection();
    console.log("Database connected");

    startScheduler();

    app.listen(env.port, () => {
        console.log(`Server running on port ${env.port}`);
    });
}

start().catch((err) => {
    console.error({ err }, "Failed to start server");
    process.exit(1);
});
