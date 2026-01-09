"use strict";

const { z } = require("zod");

// Optional date range support (YYYY-MM-DD). If not passed, service uses today's IST date.
const dashboardKpisQuerySchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

module.exports = {
    dashboardKpisQuerySchema,
};
