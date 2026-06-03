const { z } = require("zod");

const serviceAreaSchema = z.object({
    area_name: z.string().min(2).max(120),
    city: z.string().max(80).optional().nullable(),
    pincode: z.string().max(10).optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    radius_km: z.number().positive().optional().nullable(),
    boundary_geojson: z.any().optional().nullable(),
    is_active: z.boolean().optional(),
});

const createWarehouseSchema = z.object({
    name: z.string().min(2).max(120),
    address_line1: z.string().min(3).max(250),
    address_line2: z.string().max(250).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    state: z.string().max(80).optional().nullable(),
    pincode: z.string().max(10).optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    is_active: z.boolean().optional(),
    service_areas: z.array(serviceAreaSchema).optional().default([]),
});

const updateWarehouseSchema = createWarehouseSchema.partial();

module.exports = {
    createWarehouseSchema,
    updateWarehouseSchema,
    serviceAreaSchema
};
