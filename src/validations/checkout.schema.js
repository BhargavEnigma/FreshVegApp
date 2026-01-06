const { z } = require("zod");

const checkoutSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.enum(["cod", "upi"]),
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    delivery_slot_id: z.string().uuid().optional().nullable(),
});

module.exports = { checkoutSchema };
