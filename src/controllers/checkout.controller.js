const CheckoutService = require("../services/checkout.service");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");
const { checkoutSchema, checkoutLocalSchema } = require("../validations/checkout.schema");

// server cart-based checkout
// async function checkout(req, res) {
//     try {
//         const body = checkoutSchema.parse(req.body);

//         const data = await CheckoutService.checkout({
//             userId: req.user.userId,
//             payload: body,
//         });

//         return Response.created(res, 201, data);
//     } catch (e) {
//         console.log('ERROR :', e);

//         if (e instanceof AppError) {
//             return Response.fail(res, e.httpStatus || 500, e.code, e.message, null);
//         }
//         if (e?.name === "ZodError") {
//             return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request body", e.issues ?? null);
//         }
//         return Response.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
//     }
// }

// local cart based from mobile checkout
async function checkout(req, res) {
    try {
        const body = checkoutLocalSchema.parse(req.body);

        const data = await CheckoutService.checkout({
            userId: req.user.userId,
            payload: body,
        });

        return Response.created(res, 201, data);
    } catch (e) {
        console.log("CHECKOUT_LOCAL ERROR:", e);

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
