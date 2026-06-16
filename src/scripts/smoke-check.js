"use strict";

process.env.NODE_ENV = "test";

const requiredEnvDefaults = {
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_NAME: "freshveg_test",
    DB_USER: "freshveg_test",
    DB_PASSWORD: "freshveg_test",
    JWT_ACCESS_SECRET: "test_access_secret",
    JWT_REFRESH_SECRET: "test_refresh_secret",
    MSG91_AUTH_KEY: "test_msg91_auth_key",
    MSG91_TEMPLATE_ID: "test_msg91_template_id",
    CORS_ORIGINS: "http://localhost:3000",
};

for (const [key, value] of Object.entries(requiredEnvDefaults)) {
    if (!process.env[key]) {
        process.env[key] = value;
    }
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function walkJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return walkJsFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    });
}

const safeRequireDirs = [
    "config",
    "controllers",
    "middlewares",
    "routes",
    "services",
    "utils",
    "validations",
];

for (const dir of safeRequireDirs) {
    for (const file of walkJsFiles(path.join(__dirname, "..", dir))) {
        require(file);
    }
}

require("../app");

const bannersRouter = require("../routes/admin/banners.admin.routes");
const bannerRoutes = bannersRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
    }));

const reorderIndex = bannerRoutes.findIndex((route) => route.path === "/reorder" && route.methods.includes("put"));
const updateIndex = bannerRoutes.findIndex((route) => route.path === "/:bannerId" && route.methods.includes("put"));

assert.notEqual(reorderIndex, -1, "admin banners PUT /reorder route is missing");
assert.notEqual(updateIndex, -1, "admin banners PUT /:bannerId route is missing");
assert.ok(reorderIndex < updateIndex, "admin banners PUT /reorder must be registered before PUT /:bannerId");

const orderModelFactory = require("../models/Order");
const orderSource = orderModelFactory.toString();
assert.ok(!/idempotency_key:[\\s\\S]*?unique:\\s*true/.test(orderSource), "orders.idempotency_key must not be globally unique");

console.log("Smoke checks passed.");
