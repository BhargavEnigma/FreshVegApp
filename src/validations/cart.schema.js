const { z } = require("zod");

const addCartItemSchema = z.object({
    product_id: z.string().uuid().optional(),
    product_pack_id: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(999),
}).refine((v) => v.product_pack_id || v.product_id, {
    message: "Either product_pack_id or product_id is required",
    path: ["product_pack_id"],
});

const updateCartItemSchema = z.object({
    quantity: z.coerce.number().min(0.001),
});

const cartItemIdParamSchema = z.object({
    itemId: z.string().uuid(),
});

module.exports = {
    addCartItemSchema,
    updateCartItemSchema,
    cartItemIdParamSchema,
};
