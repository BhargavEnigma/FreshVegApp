"use strict";

const ResponseUtil = require("../../utils/response.util");
const AdminUsersService = require("../../services/admin/users.admin.service");
const {
    createAdminUserSchema,
    setRolesSchema,
} = require("../../validations/admin/users.admin.validation");

async function create(req, res) {
    const body = createAdminUserSchema.parse(req.body);

    const data = await AdminUsersService.createUserWithRoles({
        payload: body,
    });

    return ResponseUtil.created(res, 201, data);
}

async function setRoles(req, res) {
    const body = setRolesSchema.parse(req.body);

    const data = await AdminUsersService.setUserRoles({
        userId: req.params.id,
        roles: body.roles,
    });

    return ResponseUtil.ok(res, 200, data);
}

module.exports = {
    create,
    setRoles,
};
