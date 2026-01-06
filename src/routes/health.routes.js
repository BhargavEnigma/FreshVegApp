const express = require("express");
const Response = require("../utils/response.util");

const router = express.Router();

router.get("/", (req, res) => {
    return Response.ok(res, 200, { status: "ok" }, "FreshVeg backend healthy");
});

module.exports = router;
