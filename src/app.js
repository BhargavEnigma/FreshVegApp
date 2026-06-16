const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

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
const bannersRoutes = require("./routes/banners.routes");
const dealsRoutes = require("./routes/deals.routes");
const devicesRoutes = require("./routes/devices.routes");

const opsCategoryRoutes = require("./routes/ops/categories.routes");
const adminProductRoutes = require("./routes/admin/products.routes");
const adminDeliverySlots = require("./routes/admin/deliverySlots.admin.routes");
const adminSetting = require("./routes/admin/settings.admin.routes");
const adminBannersRoutes = require("./routes/admin/banners.admin.routes");
const adminDealsRoutes = require("./routes/admin/deals.admin.routes");
const orderOpsRoutes = require("./routes/ops/orders.ops.routes");
const adminWarehouse = require("./routes/admin/warehouses.routes");
const opsReportsRoutes = require("./routes/ops/reports.ops.routes");
const opsJobsRoutes = require("./routes/ops/jobs.ops.routes");
const opsSchedulerRoutes = require("./routes/ops/scheduler.ops.routes.js");

// Admin users + dashboard
const adminUsersRoutes = require("./routes/admin/users.admin.routes");
const adminDashboardRoutes = require("./routes/admin/dashboard.admin.routes");
const adminOrdersRoutes = require("./routes/admin/orders.admin.routes");
const adminAiRoutes = require("./routes/admin/ai.admin.routes");

const adminCostRoutes = require("./routes/admin/cost.routes");

const deliveryOrdersRoutes = require("./routes/delivery/orders.delivery.routes");

const internalJobsRoutes = require("./routes/internal/jobs.internal.routes");

const { env } = require("./config/env");
const { ensureDir, getUploadsRoot } = require("./utils/uploads");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());

// Serve uploaded assets
try {
    const uploadsRoot = getUploadsRoot();
    ensureDir(uploadsRoot);
    app.use("/uploads", express.static(path.join(uploadsRoot)));
} catch (e) {
    // Do not crash app if uploads dir can't be created (still allow non-upload flows)
}

app.use(
    "/v1/payments/webhook",
    express.raw({ type: "*/*", limit: "1mb" }),
    (req, _res, next) => {
        req.rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
        try {
            req.body = req.rawBody ? JSON.parse(req.rawBody) : {};
        } catch {
            req.body = {};
        }
        next();
    }
);

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
app.use("/v1/banners", bannersRoutes);
app.use("/v1/deals", dealsRoutes);
app.use("/v1/devices", devicesRoutes);

// ✅ Admin (move admin delivery slots under /v1/admin/deliveryslot)
app.use("/v1/admin/product", adminProductRoutes);
app.use("/v1/admin/cost", adminCostRoutes);
app.use("/v1/admin/deliveryslot", adminDeliverySlots);
app.use("/v1/adminSetting", adminSetting);
app.use("/v1/adminWarehouse", adminWarehouse);
app.use("/v1/admin/users", adminUsersRoutes);
app.use("/v1/admin/dashboard", adminDashboardRoutes);
// ✅ Aliases (more consistent paths, keep old ones for backward compatibility)
app.use("/v1/admin/setting", adminSetting);
app.use("/v1/admin/warehouse", adminWarehouse);
app.use("/v1/admin/banners", adminBannersRoutes);
app.use("/v1/admin/deals", adminDealsRoutes);
app.use("/v1/admin/orders", adminOrdersRoutes);
app.use("/v1/admin/ai", adminAiRoutes);

// ✅ Aliases (more consistent paths)
app.use("/v1/ops/orders", orderOpsRoutes);
app.use("/v1/ops/reports", opsReportsRoutes);
app.use("/v1/ops/jobs", opsJobsRoutes);
app.use("/v1/ops/scheduler", opsSchedulerRoutes);
app.use("/v1/ops/categories", opsCategoryRoutes);

app.use("/v1/delivery/orders", deliveryOrdersRoutes);

app.use("/v1/internal/jobs", internalJobsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
