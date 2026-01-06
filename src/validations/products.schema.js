const { z } = require("zod");

const listProductsQuerySchema = z.object({
    category_id: z.string().uuid().optional(),
    q: z.string().max(100).optional(),
    include_out_of_stock: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

const productIdParamSchema = z.object({
    productId: z.string().uuid(),
});

module.exports = {
    listProductsQuerySchema,
    productIdParamSchema,
};
