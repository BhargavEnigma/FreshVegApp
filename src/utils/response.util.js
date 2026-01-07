function ok(res, code, data = null, message = null) {
    return res.status(200).json({
        success: true,
        status: code,
        data,
        error: null,
        message
    });
}

function created(res, code, data = null, message = null) {
    return res.status(201).json({
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
