const { z } = require("zod");

const checkoutSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.enum(["cod", "upi"]),
    delivery_slot_id: z.string().uuid().optional().nullable(),
});

const checkoutLocalSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.enum(["cod", "upi"]), // adjust if more
    items: z
        .array(
            z.object({
                product_id: z.string().uuid(),
                product_pack_id: z.string().uuid(),
                quantity: z.number().int().positive(),
            })
        )
        .min(1),
});

module.exports = { checkoutSchema, checkoutLocalSchema };
