"use strict";

const { z } = require("zod");

const listDeliverySlotsQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    include_inactive: z.coerce.boolean().optional().nullable(), // normally false
});

module.exports = {
    listDeliverySlotsQuerySchema,
};
