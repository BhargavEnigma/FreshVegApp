"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("user_addresses", "is_serviceable", {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addIndex("user_addresses", ["user_id", "is_serviceable"], {
            name: "user_addresses_user_id_is_serviceable_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            "user_addresses",
            "user_addresses_user_id_is_serviceable_idx"
        );

        await queryInterface.removeColumn("user_addresses", "is_serviceable");
    },
};