"use strict";

const ResponseUtil = require("../../utils/response.util");
const PaymentsService = require("../../services/payments.service");
const {
    orderIdParamSchema,
    initiateRefundSchema,
} = require("../../validations/admin/orders.admin.validation");

async function getPaymentAudit(req, res) {
    const params = orderIdParamSchema.parse(req.params);
    const data = await PaymentsService.adminGetPaymentAudit({ orderId: params.orderId });
    return ResponseUtil.ok(res, 200, data);
}

async function initiateRefund(req, res) {
    const params = orderIdParamSchema.parse(req.params);
    const body = initiateRefundSchema.parse(req.body || {});
    const data = await PaymentsService.adminInitiateRefund({
        actorUserId: req.user.userId,
        orderId: params.orderId,
        reason: body.reason ?? null,
    });
    return ResponseUtil.ok(res, 200, data);
}

module.exports = {
    getPaymentAudit,
    initiateRefund,
};
