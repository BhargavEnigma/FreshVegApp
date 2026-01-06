"use strict";

const { z } = require("zod");

const settingKeyParamSchema = z.object({
    key: z.string().min(1).max(80),
});

const upsertSettingSchema = z.object({
    value: z.any(), // JSONB - Blueprint allows flexible values
});

module.exports = {
    settingKeyParamSchema,
    upsertSettingSchema,
};
