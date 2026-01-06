const CheckoutService = require("../services/checkout.service");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const { checkoutSchema } = require("../validations/checkout.schema");

async function checkout(req, res) {
    try {
        const body = checkoutSchema.parse(req.body);

        const data = await CheckoutService.checkout({
            userId: req.user.userId,
            payload: body,
        });

        return Response.created(res, data);
    } catch (e) {
        console.error("CHECKOUT ERROR:", {
            name: e?.name,
            code: e?.code,
            message: e?.message,
            httpStatus: e?.httpStatus,
            issues: e?.issues,
            stack: e?.stack,
        });

        if (e instanceof AppError) {
            return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
        }
        if (e?.name === "ZodError") {
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
        }
        return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
    }
}

module.exports = { checkout };
