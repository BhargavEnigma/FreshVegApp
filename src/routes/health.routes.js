const express = require("express");
const Response = require("../utils/response.util");
const { sequelize } = require("../models");

const router = express.Router();

router.get("/", (req, res) => {
    return Response.ok(res, 200, { status: "ok" }, "FreshVeg backend healthy");
});

router.get("/ready", async (req, res) => {
    try {
        await sequelize.authenticate();

        return Response.ok(
            res,
            200,
            {
                status: "ready",
                db: "connected",
            },
            "FreshVeg backend ready"
        );
    } catch (e) {
        return Response.fail(
            res,
            503,
            "NOT_READY",
            "FreshVeg backend is not ready",
            {
                db: "disconnected",
            }
        );
    }
});

module.exports = router;