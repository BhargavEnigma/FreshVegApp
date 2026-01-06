"use strict";

const { z } = require("zod");

const addressIdParamSchema = z.object({
    id: z.string().uuid(),
});

const phone10 = z
    .string()
    .regex(/^\d{10}$/, "Phone must be 10 digits")
    .optional()
    .nullable();

const createAddressSchema = z.object({
    label: z.string().max(50).optional().nullable(),
    name: z.string().max(100).optional().nullable(),
    phone: phone10,

    address_line1: z.string().min(3).max(250),
    address_line2: z.string().max(250).optional().nullable(),
    landmark: z.string().max(150).optional().nullable(),
    area: z.string().max(150).optional().nullable(),

    city: z.string().max(80).optional().nullable(),
    state: z.string().max(80).optional().nullable(),
    pincode: z.string().min(4).max(10),

    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),

    is_default: z.boolean().optional().nullable(),
});

const updateAddressSchema = z.object({
    label: z.string().max(50).optional().nullable(),
    name: z.string().max(100).optional().nullable(),
    phone: phone10,

    address_line1: z.string().min(3).max(250).optional().nullable(),
    address_line2: z.string().max(250).optional().nullable(),
    landmark: z.string().max(150).optional().nullable(),
    area: z.string().max(150).optional().nullable(),

    city: z.string().max(80).optional().nullable(),
    state: z.string().max(80).optional().nullable(),
    pincode: z.string().min(4).max(10).optional().nullable(),

    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),

    is_default: z.boolean().optional().nullable(),
});

module.exports = {
    addressIdParamSchema,
    createAddressSchema,
    updateAddressSchema,
};
