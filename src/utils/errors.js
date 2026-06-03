class AppError extends Error {
    constructor(code, message, httpStatus = 400, details = null) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
    }
}

module.exports = { AppError };