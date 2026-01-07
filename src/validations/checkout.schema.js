const { z } = require("zod");

const checkoutSchema = z.object({
    address_id: z.string().uuid(),
    payment_method: z.enum(["cod", "upi"]),
    delivery_slot_id: z.string().uuid().optional().nullable(),
});

module.exports = { checkoutSchema };
