"use strict";

const { z } = require("zod");

// Public deals endpoint: /v1/deals/today (optional: date override for testing)
const getDealsQuerySchema = z.object({
    // YYYY-MM-DD (IST)
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

module.exports = {
    getDealsQuerySchema,
};
