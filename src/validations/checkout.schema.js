const { z } = require("zod");

const checkoutSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.enum(["cod", "online"]),
    delivery_slot_id: z.string().uuid().optional().nullable(),
});

const checkoutLocalSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.string().transform((v) => {
        const x = String(v || "").trim().toLowerCase();
        if (x === "upi") return "online";
        return x;
    }).refine((v) => v === "cod" || v === "online", "payment_method must be 'cod' or 'online'"),
    delivery_slot_id: z.string().uuid().optional().nullable(),
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
