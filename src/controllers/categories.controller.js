"use strict";

const ResponseUtil = require("../utils/response.util");
const CategoriesService = require("../services/categories.service");
const { AppError } = require("../utils/errors");
const {
    listPublicSchema,
    listOpsSchema,
    createCategorySchema,
    updateCategorySchema,
    reorderSchema,
    uuidSchema,
} = require("../validations/category.validation");

function handleError(res, e) {
    if (e instanceof AppError) {
        return ResponseUtil.fail(res, e.httpStatus || 500, e.code, e.message, e.details || null);
    }
    if (e?.name === "ZodError") {
        return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "Invalid request", e.issues ?? null);
    }
    return ResponseUtil.fail(res, 500, "PROVIDER_ERROR", "Something went wrong");
}

async function listPublic(req, res) {
    try {
        const query = listPublicSchema.parse(req.query);
        const data = await CategoriesService.listPublic({ q: query.q || null });
        return ResponseUtil.ok(res, 200, { categories: data });
    } catch (e) {
        return handleError(res, e);
    }
}

async function listOps(req, res) {
    try {
        const query = listOpsSchema.parse(req.query);
        const data = await CategoriesService.listOps({
            q: query.q || null,
            include_inactive: query.include_inactive || false,
        });
        return ResponseUtil.ok(res, 200, { categories: data });
    } catch (e) {
        return handleError(res, e);
    }
}

async function getById(req, res) {
    try {
        const id = uuidSchema.parse(req.params.id);
        const row = await CategoriesService.getById(id);
        return ResponseUtil.ok(res, 200, { category: row });
    } catch (e) {
        return handleError(res, e);
    }
}

async function create(req, res) {
    try {
        const body = createCategorySchema.parse(req.body);
        const row = await CategoriesService.create({
            name: body.name,
            slug: body.slug ?? null,
            is_active: body.is_active ?? true,
            sort_order: body.sort_order ?? null,
        });
        return ResponseUtil.created(res, 201, { category: row });
    } catch (e) {
        return handleError(res, e);
    }
}

async function update(req, res) {
    try {
        const id = uuidSchema.parse(req.params.id);
        const body = updateCategorySchema.parse(req.body);
        const row = await CategoriesService.update(id, body);
        return ResponseUtil.ok(res, 200, { category: row });
    } catch (e) {
        return handleError(res, e);
    }
}

async function toggleActive(req, res) {
    try {
        const id = uuidSchema.parse(req.params.id);

        // ✅ FIX: correctly allow false
        let isActive = null;
        if (typeof req.body?.is_active === "boolean") {
            isActive = req.body.is_active;
        } else if (typeof req.query?.is_active === "string") {
            if (req.query.is_active === "true") isActive = true;
            if (req.query.is_active === "false") isActive = false;
        }

        if (typeof isActive !== "boolean") {
            return ResponseUtil.fail(res, 400, "VALIDATION_ERROR", "is_active must be boolean", null);
        }

        const row = await CategoriesService.toggleActive(id, isActive);
        return ResponseUtil.ok(res, 200, { category: row });
    } catch (e) {
        return handleError(res, e);
    }
}

async function reorder(req, res) {
    try {
        const body = reorderSchema.parse(req.body);
        await CategoriesService.reorder(body.items);
        return ResponseUtil.ok(res, 200, { reordered: true });
    } catch (e) {
        return handleError(res, e);
    }
}

module.exports = {
    listPublic,
    listOps,
    getById,
    create,
    update,
    toggleActive,
    reorder,
};
