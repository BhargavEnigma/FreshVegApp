const Response = require("../utils/response.util");

function validate(schema) {
    return function validateMiddleware(req, res, next) {
        const parsed = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params
        });

        if (!parsed.success) {
            const details = parsed.error.flatten();
            return Response.fail(res, 400, "VALIDATION_ERROR", "Invalid request data", details);
        }

        req.validated = parsed.data;
        return next();
    };
}

module.exports = { validate };
