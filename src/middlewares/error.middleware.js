const { ZodError } = require("zod");
const Response = require("../utils/response.util");
const { AppError } = require("../utils/errors");

function notFound(req, res) {
    return Response.fail(res, 404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`);
}

function errorHandler(err, req, res, next) {
    if (err instanceof ZodError) {
        return Response.fail(
            res,
            400,
            "VALIDATION_ERROR",
            "Invalid request",
            err.issues ?? null
        );
    }

    const status =
        err instanceof AppError
            ? err.httpStatus
            : err?.httpStatus || err?.statusCode || err?.status || 500;

    const code =
        err instanceof AppError
            ? err.code
            : err?.code || "INTERNAL_ERROR";

    const message = err?.message || "Something went wrong";
    const details = err?.details || null;

    console.error({ err, path: req.originalUrl }, "Unhandled error");

    return Response.fail(res, status, code, message, details);
}

module.exports = { notFound, errorHandler };