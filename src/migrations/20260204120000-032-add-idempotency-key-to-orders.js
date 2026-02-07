"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1) Add column
        await queryInterface.addColumn("orders", "idempotency_key", {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        // 2) Add unique index for dedupe per user
        await queryInterface.addIndex("orders", ["user_id", "idempotency_key"], {
            name: "orders_user_idempotency_key_uniq",
            unique: true,
            where: {
                idempotency_key: {
                    [Sequelize.Op.ne]: null,
                },
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex("orders", "orders_user_idempotency_key_uniq");
        await queryInterface.removeColumn("orders", "idempotency_key");
    },
};
