const Response = require("../utils/response.util");
const { User } = require("../models");

async function me(req, res) {
    const userId = req.auth.userId;
    const user = await User.findByPk(userId, {
        attributes: ["id", "phone", "firstName", "lastName", "status", "createdAt", "updatedAt", "lastLoginAt"]
    });

    if (!user) {
        return Response.fail(res, 404, "NOT_FOUND", "User not found");
    }

    return Response.ok(res, user);
}

module.exports = { me };
