"use strict";

const ResponseUtil = require("../../utils/response.util");
const AdminUsersService = require("../../services/admin/users.admin.service");
const {
    createAdminUserSchema,
    setRolesSchema,
    listUsersQuerySchema,
} = require("../../validations/admin/users.admin.validation");

async function list(req, res) {
    const query = listUsersQuerySchema.parse(req.query || {});

    const data = await AdminUsersService.listUsers({
        query,
    });

    return ResponseUtil.ok(res, 200, data);
}

async function getById(req, res) {
    const data = await AdminUsersService.getUserById({
        userId: req.params.id,
    });

    return ResponseUtil.ok(res, 200, data);
}

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
    list,
    getById
};
