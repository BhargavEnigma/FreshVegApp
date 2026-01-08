const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/user.routes");
const addressesRoutes = require("./routes/addresses.routes");
const productsRoutes = require("./routes/products.routes");
const cartRoutes = require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const deliverySlotRoutes = require("./routes/deliverySlots.routes");
const settingsRoutes = require("./routes/settings.routes");
const paymentsRoutes = require("./routes/payments.routes");
const catalogRoutes = require("./routes/catalog.routes");
const ordersRoutes = require("./routes/orders.routes");

const opsCategoryRoutes = require("./routes/ops/categories.routes");
const adminProductRoutes = require("./routes/admin/products.routes");
const adminDeliverySlots = require("./routes/admin/deliverySlots.admin.routes");
const adminSetting = require("./routes/admin/settings.admin.routes");
const orderOpsRoutes = require("./routes/ops/orders.ops.routes");
const adminWarehouse = require("./routes/admin/warehouses.routes");
const opsReportsRoutes = require("./routes/ops/reports.ops.routes");
const opsJobsRoutes = require("./routes/ops/jobs.ops.routes");

// ✅ NEW: admin users management routes
const adminUsersRoutes = require("./routes/admin/users.admin.routes");

const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use("/v1/health", healthRoutes);

// src/app.js (add before app.use(express.json()))
app.use((req, res, next) => {
    if (req.originalUrl === "/v1/payments/webhook") {
        let data = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
            data += chunk;
        });
        req.on("end", () => {
            req.rawBody = data;
            try {
                req.body = data ? JSON.parse(data) : {};
            } catch {
                req.body = {};
            }
            next();
        });
        return;
    }
    next();
});

app.use(
    cors({
        origin: env.corsOrigins.length ? env.corsOrigins : true,
        credentials: false,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/health", healthRoutes);
app.use("/v1/auth", authRoutes);
app.use("/v1/user", usersRoutes);
app.use("/v1/address", addressesRoutes);
app.use("/v1/products", productsRoutes);
app.use("/v1/cart", cartRoutes);
app.use("/v1/checkout", checkoutRoutes);

app.use("/v1/deliveryslot", deliverySlotRoutes);

app.use("/v1/setting", settingsRoutes);
app.use("/v1/payments", paymentsRoutes);
app.use("/v1/catalog", catalogRoutes);
app.use("/v1/orders", ordersRoutes);

// ✅ Admin (move admin delivery slots under /v1/admin/deliveryslot)
app.use("/v1/admin/product", adminProductRoutes);
app.use("/v1/admin/deliveryslot", adminDeliverySlots);
app.use("/v1/adminSetting", adminSetting);
app.use("/v1/adminWarehouse", adminWarehouse);

// ✅ NEW: Admin user/role management
app.use("/v1/admin/users", adminUsersRoutes);

// Ops / Warehouse
app.use("/v1/opsOrder", orderOpsRoutes);
app.use("/v1/opsReports", opsReportsRoutes);
app.use("/v1/opsJobs", opsJobsRoutes);
app.use("/v1/opsCategories", opsCategoryRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app }; 