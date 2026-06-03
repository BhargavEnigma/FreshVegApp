"use strict";

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        `);
    },

    async down() {
        // Keep pgcrypto enabled; other tables/defaults depend on it.
    },
};