"use strict";

const Response = require("../utils/response.util");
const PaymentsService = require("../services/payments.service");

async function webhook(req, res) {
    const data = await PaymentsService.handleWebhook({
        headers: req.headers,
        payload: req.body,
        rawBody: req.rawBody || JSON.stringify(req.body || {}),
    });

    return Response.ok(res, data);
}

module.exports = { webhook };
