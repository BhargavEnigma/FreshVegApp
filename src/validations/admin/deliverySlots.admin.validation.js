"use strict";

const { z } = require("zod");

const slotIdParamSchema = z.object({
    id: z.string().uuid(),
});

const createDeliverySlotSchema = z.object({
    name: z.string().min(2).max(80),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), // HH:MM or HH:MM:SS
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    is_active: z.boolean().optional().nullable(),
});

const updateDeliverySlotSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

const setActiveSchema = z.object({
    is_active: z.boolean(),
});

module.exports = {
    slotIdParamSchema,
    createDeliverySlotSchema,
    updateDeliverySlotSchema,
    setActiveSchema,
};
