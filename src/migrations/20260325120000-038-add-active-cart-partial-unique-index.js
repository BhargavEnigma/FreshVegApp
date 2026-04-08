"use strict";

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS carts_one_active_cart_per_user_idx
            ON carts (user_id)
            WHERE status = 'active';
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS carts_one_active_cart_per_user_idx;
        `);
    },
};