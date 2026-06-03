"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.addColumn(
                "orders",
                "delivery_label",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_name",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_phone",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_address_line1",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_address_line2",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_landmark",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_area",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_city",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_state",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_pincode",
                {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_lat",
                {
                    type: Sequelize.DECIMAL(10, 7),
                    allowNull: true,
                },
                { transaction: t }
            );

            await queryInterface.addColumn(
                "orders",
                "delivery_lng",
                {
                    type: Sequelize.DECIMAL(10, 7),
                    allowNull: true,
                },
                { transaction: t }
            );

            // Backfill existing orders from linked address rows
            await queryInterface.sequelize.query(
                `
                UPDATE orders o
                SET
                    delivery_label = ua.label,
                    delivery_name = ua.name,
                    delivery_phone = ua.phone,
                    delivery_address_line1 = ua.address_line1,
                    delivery_address_line2 = ua.address_line2,
                    delivery_landmark = ua.landmark,
                    delivery_area = ua.area,
                    delivery_city = ua.city,
                    delivery_state = ua.state,
                    delivery_pincode = ua.pincode,
                    delivery_lat = ua.lat,
                    delivery_lng = ua.lng
                FROM user_addresses ua
                WHERE o.address_id = ua.id
                `,
                { transaction: t }
            );

            // After snapshot is filled, allow old terminal orders to detach from address
            await queryInterface.changeColumn(
                "orders",
                "address_id",
                {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: { model: "user_addresses", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "RESTRICT",
                },
                { transaction: t }
            );

            await t.commit();
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.changeColumn(
                "orders",
                "address_id",
                {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: "user_addresses", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "RESTRICT",
                },
                { transaction: t }
            );

            await queryInterface.removeColumn("orders", "delivery_lng", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_lat", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_pincode", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_state", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_city", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_area", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_landmark", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_address_line2", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_address_line1", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_phone", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_name", { transaction: t });
            await queryInterface.removeColumn("orders", "delivery_label", { transaction: t });

            await t.commit();
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },
};