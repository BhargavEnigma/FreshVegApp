const Response = require("../utils/response.util");

function notFound(req, res) {
    return Response.fail(res, 404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`);
}

function errorHandler(err, req, res, next) {
    const status = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    const message = err.message || "Something went wrong";

    console.error({ err, path: req.originalUrl }, "Unhandled error");

    return Response.fail(res, status, code, message, err.details || null);
}

module.exports = { notFound, errorHandler };
