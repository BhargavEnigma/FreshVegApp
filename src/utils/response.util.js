function ok(res, code = 200, data = null, message = null) {
    return res.status(code).json({
        success: true,
        status: code,
        data,
        error: null,
        message
    });
}

function created(res, code = 201, data = null, message = null) {
    return res.status(code).json({
        success: true,
        status: code,
        data,
        error: null,
        message
    });
}

function fail(res, statusCode, code, message, details = null) {
    return res.status(statusCode).json({
        success: false,
        data: null,
        error: { code, message, details },
        message: null
    });
}

module.exports = { ok, created, fail };