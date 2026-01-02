const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const authRoutes = require("./routes/auth.routes");

const { env } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
    cors({
        origin: env.corsOrigins.length ? env.corsOrigins : true,
        credentials: false
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
