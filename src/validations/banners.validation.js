"use strict";

const { z } = require("zod");

const listBannersQuerySchema = z.object({
    placement: z.string().max(50).optional().default("home"),
});

module.exports = {
    listBannersQuerySchema,
};
