const AiAdminService = require("../../services/admin/ai.admin.service");

async function generateProductDescription(req, res, next) {
    try {
        const { name } = req.body || {};

        const description =
            await AiAdminService.generateProductDescription({
                name,
            });

        return res.json({
            success: true,
            data: {
                description,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    generateProductDescription,
};